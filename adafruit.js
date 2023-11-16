/*
 * ------------------------------------------------------------------------
 *
 *        _____ _      _____ _             _        ____        _   
 *       |  __ (_|    / ____| |           | |      |  _ \      | |  
 *       | |__) _    | (___ | |_ ___   ___| | __   | |_) | ___ | |_ 
 *       |  ___| |    \___ \| __/ _ \ / __| |/ /   |  _ < / _ \| __|      
 *       | |   | |    ____) | || (_) | (__|   <    | |_) | (_) | |_ 
 *       |_|   |_|   |_____/ \__\___/ \___|_|\_\   |____/ \___/ \__|
 *
 *
 *
 * Author:      Logan S. ~ EthyMoney (Discord and GitHub)
 * Program:     Adafruit Raspberry Pi Stock Bot
 * GitHub:      https://github.com/EthyMoney/Adafruit-Pi-Stock-Bot
 *
 * Discord and Slack bot that sends stock alerts of Raspberry Pi models on Adafruit.com
 *
 * No parameters on start. Ensure config.json is configured correctly prior to running.
 *
 * If you find this helpful, consider donating to show support :)
 * ETH address: 0x169381506870283cbABC52034E4ECc123f3FAD02
 *
 *
 *                        Hello from Minnesota USA!                        
 *                              ⋆⁺₊⋆ ☾ ⋆⁺₊⋆
 *
 * ------------------------------------------------------------------------
*/



// -------------------------------------------
// -------------------------------------------
//
//           SETUP AND DECLARATIONS
//
// -------------------------------------------
// -------------------------------------------

// import the package json
import * as packageJson from './package.json' assert { type: "json" };
import { Client, GatewayIntentBits, ShardClientUtil, EmbedBuilder, ChannelType, PermissionFlagsBits, Colors } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
import axios from 'axios';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';
import fs from 'fs';
const clientShardHelper = new ShardClientUtil(client);
const config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
const models = JSON.parse(fs.readFileSync('config/models.json', 'utf8'));
let configuredGuild;       // the discord guild to send the stock status to (gets initialized in the ready event)

console.log(chalk.cyan("\nWelcome to Adafruit Pi Stock Bot! :)\n"));
console.log(chalk.blue("Author: " + chalk.cyan("Logan S. ~ EthyMoney (Discord and GitHub)")));
console.log(chalk.blue("Version: " + chalk.cyan(packageJson.default.version)) + "\n");

// flags indicating current stock status of each model (used to prevent sending the same in-stock messages multiple times)
// it's automatically generated based on the models.json file
const stockFlags = {};
const alreadySentFlags = {};
Object.keys(models.models).forEach(model => {
  // check if the model is enabled in the config, if not, don't add it to the stockFlags object, we will ignore it
  if (config.modelsSelection[models.models[model].configFileName]) {
    stockFlags[model] = false;
    alreadySentFlags[model] = false;
    // also add the key name to the models object under the new key "lookupKey" for convenience
    models.models[model].lookupKey = model;
  }
  stockFlags[model] = false;
});

// flag indicating if the bot is currently suspended from making queries to Adafruit.com (sleep mode to not query outside of their restock hours)
let sleepModeActive = false;

// check that at least one bot is enabled and complain to the user if not
if (!config.discord.enableBot && !config.slack.enableBot) {
  console.log(chalk.red('\n[ERROR]') + ' At least one bot must be enabled in config.json. Please enable the bot(s) you want to use and ensure they are configured properly. Exiting...');
  console.log(chalk.yellow('See the README.md for more information if you need help.\n'));
  process.exit(1);
}

// connect to discord (if discord bot is enabled)
if (config.discord.enableBot) client.login(config.discord.token);

// schedule the stock status update to be called at the specified interval
setInterval(() => { checkStockStatus(); }, config.generalSettings.updateIntervalSeconds * 1000);

// show a startup message so the user knows the bot is running (if only using the Slack bot)
if (!config.discord.enableBot) {
  console.log(chalk.green(chalk.yellow('\n[BOT START]\n') + 'I\'m watching for stock updates now! I\'ll check Adafruit every ' + chalk.cyan(config.generalSettings.updateIntervalSeconds) + ' seconds...\n'));
}



// -------------------------------------------
// -------------------------------------------
//
//          DISCORD EVENT HANDLERS
//
// -------------------------------------------
// -------------------------------------------

// runs once the discord bot has logged in and is ready to send messages
// this is when we want to do our discord setup tasks and make an initial stock status check

client.on('ready', () => {
  console.log(chalk.greenBright(`Logged into Discord as ${client.user.tag} in ${client.guilds.cache.size} servers while using ${clientShardHelper.count} shard(s)!`));
  // set the bot's presence
  client.user.setActivity('for Pis!', { type: 'WATCHING' });
  // get the discord guild to send the stock status to
  try {
    configuredGuild = client.guilds.cache.get(config.discord.serverID);
  }
  catch (err) {
    console.error(chalk.red(`Error looking up guild with provided ID ${config.discord.serverID}\n:`), err);
    // since the guild wasn't found, we need to exit here because the rest of the discord abilities will not work and simply crash the bot when they get called
    // the user needs to either fix the configured ID, or disable the discord bot
    process.exit(1);
  }
  // verify and set up the configured discord server if it's not already set up
  setupDiscordServer();
  // run a stock status check on startup (will run on configured interval after this)
  checkStockStatus();
});



// -------------------------------------------
// -------------------------------------------
//
//              CORE FUNCTIONS
//
// -------------------------------------------
// -------------------------------------------

// function to query the Adafruit website for the stock stats of all models of the Raspberry Pi 4 Model B

function checkStockStatus() {
  // if sleep mode is enabled in config.json, this will only check stock status between 6am to 8pm (CDT) (11am to 1am UTC)
  // the website is only likely to be updated between these times so we don't need to spam Adafruit's servers overnight
  if (config.generalSettings.enableSleepMode) {
    const currentTime = new Date();
    const currentHourUTC = currentTime.getUTCHours();
    if (currentHourUTC >= 1 && currentHourUTC < 11) {
      if (!sleepModeActive) {
        sleepModeActive = true;
        console.log(chalk.yellow('Sleeping mode is now active, we\'ll not check stock status outside of Adafruit\'s hours!'));
      }
      return;
    }
    else if (!(currentHourUTC >= 1 && currentHourUTC < 11) && sleepModeActive) {
      sleepModeActive = false;
      console.log(chalk.green('Sleeping mode is now disabled, I\'m actively checking stock status again!'));
    }
  }

  // iterate through all models and for each one that is enabled to check in the config, check the stock status.
  // all newly in stock models will get reported by the box if there are any that went in stock since the last check and have not been reported yet
  const modelsKeys = Object.keys(models.models);
  let modelsGroupedByPages = [];
  const ungroupedModels = [];
  Object.keys(config.modelsSelection).forEach(key => {
    for (let i = 0; i < modelsKeys.length; i++) {
      if (models.models[modelsKeys[i]].configFileName == key) {
        if (config.modelsSelection[key]) {
          if (!models.models[modelsKeys[i]].commonProductPageIdentifier.length > 0) {
            // no commonProductPageIdentifier, so add to ungroupedModels array
            ungroupedModels.push(models.models[modelsKeys[i]]);
            return;
          }
          // group the models by their commonProductPageIdentifier property since some will have some in common
          // add each one with the commonProductPageIdentifier as a key into an array of the model objects
          if (!modelsGroupedByPages[models.models[modelsKeys[i]].commonProductPageIdentifier]) {
            // create new group
            modelsGroupedByPages[models.models[modelsKeys[i]].commonProductPageIdentifier] = [models.models[modelsKeys[i]]]
          }
          else {
            // add to existing group
            let temp = modelsGroupedByPages[models.models[modelsKeys[i]].commonProductPageIdentifier]
            temp.push(models.models[modelsKeys[i]]);
            modelsGroupedByPages[models.models[modelsKeys[i]].commonProductPageIdentifier] = temp;
          }
        }
      }
    }
  })

  // clean up the modelsGroupedByPages array so it's not an object with keys, but just an array of arrays now that we don't need the keys anymore
  let newArray = [];
  for (const key in modelsGroupedByPages) {
    if (modelsGroupedByPages.hasOwnProperty(key)) {
      newArray.push(modelsGroupedByPages[key]);
    }
  }
  modelsGroupedByPages = newArray;

  // for each common page, make one page request and check the status of each of the models on that page
  modelsGroupedByPages.forEach(pageGroup => {
    // use the URL of the fist model in the group to make the request for checking all models on the page
    const model = pageGroup[0];
    axios.get(model.url)
      .then(function (response) {
        // on successful pull, select the HTML from the response and parse it into a DOM object
        const html = response.data;
        const dom = new JSDOM(html);

        // query the DOM to get all of the HTML list <li> elements that contain the stock status for each model
        const stockList = dom.window.document.querySelector('#prod-stock').querySelectorAll('li');

        pageGroup.forEach(model => {
          // gather the stock status of each model (represented as a boolean for being in-stock or not)
          // check if the text doesn't contain the text "Out of Stock" (will be showing the price instead if it's actually in stock
          let modelInStock = stockList[model.commonProductPageCartButtonIndex].textContent.toLowerCase().indexOf('out of stock') === -1;

          // Check new stock statuses against old cached status to see if any models have come in stock that weren't previously
          // This check will prevent sending another notification for a model that has already had a notification sent for it
          checkForNewStock(modelInStock, model);
        });

      }).catch(function (error) {
        console.error(chalk.red('An error occurred during the status refresh:\n'), error);
      });
  });

  // check the ungrouped models (ones that don't have a commonProductPageIdentifier) separately
  ungroupedModels.forEach(model => {
    axios.get(model.url)
      .then(function (response) {
        // on successful pull, select the HTML from the response and parse it into a DOM object
        const html = response.data;
        const dom = new JSDOM(html);

        // Look for the add to cart button
        let modelInStock = checkForAddToCartButton(dom.window.document);

        // Check new stock status against old cached status to see if any models have come in stock that weren't previously
        // This check will prevent sending another notification for a model that has already had a notification sent for it
        checkForNewStock(modelInStock, model);

      }).catch(function (error) {
        console.error(chalk.red('An error occurred during the status refresh:\n'), error);
        console.log("During this error, we were looking at " + model.name + " : " + model.url);
      });
  });

  // send the stock status to discord and/or slack if any stock flags are true (in stock)
  let atLeastOneInStock = false;
  Object.keys(stockFlags).forEach(model => {
    if (stockFlags[model]) {
      atLeastOneInStock = true;
    }
  });
  if (atLeastOneInStock) {
    // at least one model is in stock, log to console and send the notification(s)
    console.log(chalk.greenBright('The following models are in stock:'));
    Object.keys(stockFlags).forEach(model => {
      if (stockFlags[model]) {
        console.log(chalk.cyan(`- ${models.models[model].name}`));
      }
    });
    if (config.discord.enableBot) {
      sendToDiscord();
    }
    if (config.slack.enableBot) {
      sendToSlack();
    }
  }
}


//------------------------------------------
//------------------------------------------

// this function handles verifying the servers, channels, and roles for discord, then sending the actual notification message out
// this will send *one* notification message embed that contains all models that are in stock, rather than separate messages for each model (like the slack function does)

function sendToDiscord() {
  console.log(chalk.greenBright('Sending stock status to Discord...'));
  let mentionRolesMessage = ''; // will be populated with the roles to mention based on status of each model
  // grab the roles and channels cache from the configured guild
  const rolesCache = configuredGuild.roles.cache;
  const channelsCache = configuredGuild.channels.cache;

  // create the template embed to send to discord
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle("Adafruit Raspberry Pies In Stock!")
    .setDescription('The following models are in stock:\n')
    .setThumbnail('https://assets.stickpng.com/images/584830fecef1014c0b5e4aa2.png')
    .setTimestamp()
    .setAuthor({ name: 'Adafruit Pi Stock Bot', iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png', url: 'https://github.com/EthyMoney/Adafruit-Pi-Stock-Bot' })
    .setFooter({
      text: 'In Stock',
      iconURL: 'https://assets.stickpng.com/images/584830fecef1014c0b5e4aa2.png'
    });

  // populate stock fields for all in-stock models where notification is enabled in the config
  // this allows us to group updates together into one message rather than spamming the channel with a message for each model when multiple are in stock at once
  let fieldsCounter = 0;
  let lastMetaObj = {};
  Object.keys(stockFlags).forEach(model => {
    if (stockFlags[model]) {
      const modelMeta = models.models[model];
      embed.addFields({ name: modelMeta.discordFieldName, value: `[BUY IT!](${modelMeta.url})`, inline: true })
      const modelRole = rolesCache.find(role => role.name === modelMeta.discordRole);
      mentionRolesMessage += (modelRole) ? ` ${modelRole} ` : console.error(chalk.red('No role found for model: ' + modelMeta.name + ', expected role: ' + modelMeta.discordRole + ''));
      fieldsCounter++;
      lastMetaObj = modelMeta;
    }
  });

  // if only one model is in stock, we can send a more specific message
  if (fieldsCounter === 1) {
    embed.setTitle(lastMetaObj.discordTitle)
    embed.setDescription(null);
    embed.setThumbnail(lastMetaObj.image);
  }

  // lookup the configured discord TEXT channel by name and send the embed out to the channel
  const channel = channelsCache.find(channel => channel.name === config.discord.channelName.toString() && channel.type === 0);

  // if the channel was found, send the embed and mention messages
  if (channel) {
    channel.send({ embeds: [embed] })
      .then(() => {
        console.log(chalk.greenBright('Successfully sent notification EMBED to Discord!'));
      })
      .catch(function (reject) {
        console.error(chalk.red(`Error sending EMBED message to server ${chalk.cyan(configuredGuild.name)} with promise rejection: ${reject}`));
      });

    // also mention all the relevant users that have the applicable model roles (if the roles could be found in the server)
    if (mentionRolesMessage && mentionRolesMessage !== '' && mentionRolesMessage !== 'undefined' && typeof mentionRolesMessage !== 'undefined') {
      channel.send(mentionRolesMessage.trim())
        .then(() => {
          console.log(chalk.greenBright('Successfully sent MENTION message to Discord!'));
        })
        .catch(function (reject) {
          console.error(chalk.red(`Error sending MENTION message to server ${chalk.cyan(configuredGuild.name)} with promise rejection: ${reject}`));
        });
    }
  }
  else {
    console.error(chalk.red('No text channel found in server with name: ' + chalk.cyan('"' + config.discord.channelName + '"')), chalk.yellow('Did you delete/rename it? Can I see it? Check your config!'));
  }
}


//------------------------------------------
//------------------------------------------

// function to send stock statuses to Slack for models that are in stock
// this will send each model in stock as separate notification messages if multiple models are in stock at once

async function sendToSlack() {
  console.log(chalk.greenBright('Sending stock status to Slack...'));
  const url = 'https://slack.com/api/chat.postMessage';
  const authorizationHeader = { headers: { authorization: `Bearer ${config.slack.token}` } };

  // for each model in stock, generate and post a message to slack
  Object.keys(stockFlags).forEach(model => {
    if (stockFlags[model]) {
      const modelMeta = models.models[model];
      const channel = config.slack.channelName;
      const username = modelMeta.slackBotShortName;
      const messageText = modelMeta.slackMessage + ' <' + modelMeta.url + '|BUY IT>';
      postMessage(channel, username, messageText, modelMeta.slackBotShortName);
    }
  });

  // nested function to post the message(s) (called for each model)
  async function postMessage(channel, username, messageText, model) {
    await axios.post(url, {
      channel: channel,
      username: username,
      link_names: true,
      text: messageText
    }, authorizationHeader)
      .then(() => {
        console.log(chalk.greenBright(`Successfully sent ${model} stock status to Slack!`));
      })
      .catch(function (reject) {
        console.error(chalk.red(`Error sending ${model} stock status to Slack with promise rejection: ${reject}`));
      });
  }
}



// -------------------------------------------
// -------------------------------------------
//
//             UTILITY FUNCTIONS
//
// -------------------------------------------
// -------------------------------------------

// function that runs on startup to set up the configured discord server with the necessary roles and a notification channel to post in

function setupDiscordServer() {
  // first, define the roles we need in the server based on the config (in RGB cus we're real gamers here)
  const roles = [];
  Object.keys(config.modelsSelection).forEach(key => {
    // this is looking for the config name in each model object that matches the key name of the config selection, then we can grab the discord role settings from it
    const modelsKeys = Object.keys(models.models);
    let selectedModelMeta;
    for (let i = 0; i < modelsKeys.length; i++) {
      if (models.models[modelsKeys[i]].configFileName == key) {
        selectedModelMeta = models.models[modelsKeys[i]];
        if (config.modelsSelection[key]) {
          roles.push({ name: selectedModelMeta.discordRole, color: Colors[selectedModelMeta.discordRoleColor] })
        }
      }
    }
  });

  // create the roles in the server if they don't exist yet
  roles.forEach(role => {
    if (!configuredGuild.roles.cache.find(r => r.name == role.name)) {
      configuredGuild.roles.create({
        name: role.name,
        color: role.color,
        reason: 'Auto-created by Pi Stock Bot for stock notifications',
      })
        .then(role => {
          console.log(chalk.green(`Created role: ${role.name}`));
        })
        .catch(err => {
          console.error(chalk.red(`Error creating role: ${role.name}\n:`), err);
        });
    }
  });
  // create the notification channel if an existing one wasn't specified in the config (this will also trigger if configured channel is misspelled or in wrong case in config file)
  if (!configuredGuild.channels.cache.find(c => c.name == config.discord.channelName)) {
    configuredGuild.channels.create({
      name: 'pi-stock-notifications',
      type: ChannelType.GuildText,
      reason: 'Auto-created by Pi Stock Bot for stock notifications',
      permissionOverwrites: [
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
        },
      ],
    })
      .then(channel => {
        // set the notification channel in the config to be this new one (so it can be used in the future)
        config.discord.channelName = 'pi-stock-notifications';
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        console.log(chalk.green('You didn\'t provide a channel name or it wasn\'t able to be found in the server, so I created one for you!'));
        console.log(chalk.green(`The new channel is named: ${chalk.cyan(channel.name)}`));
      })
      .catch(err => {
        console.error(
          chalk.red('Error creating default notification channel, either set the correct one in your config or correct what is preventing me from doing it (likely a permissions issue)\n'), err);
      });
  }
  console.log(chalk.greenBright(`Discord server setup complete for ${chalk.cyan(configuredGuild.name)}  Lets go! ⚡⚡⚡`));
  console.log(chalk.green(chalk.yellow('\n[BOT START]\n') + 'I\'m watching for stock updates now! I\'ll check Adafruit every ' + chalk.cyan(config.generalSettings.updateIntervalSeconds) + ' seconds...\n'));
}


//------------------------------------------
//------------------------------------------

// Function to check for 'Add to Cart' button

function checkForAddToCartButton(document) {
  const prodStock = document.querySelector("#prod-stock");
  if (!prodStock) return false;

  const buttons = prodStock.querySelectorAll("button");
  for (let button of buttons) {
    if (button.textContent === "Add to Cart") {
      return true;
    }
  }
  return false;
}


//------------------------------------------
//------------------------------------------

// check new statuses against the old cached ones to see if any models have come in stock that weren't previously
// this is done so we don't send another notification for a model that has already had a notification sent for it
// the active status flags get reset when the models go out of stock again so that the next restock will be captured

function checkForNewStock(stockStatusOnSite, model) {
  const modelLookupKey = findKeyOfObject(models.models, model);
  let adjustedStatus = false;
  // if the model is in stock and the cached status is false (not in stock), set the active status flag to true
  if (stockStatusOnSite && !alreadySentFlags[modelLookupKey]) {
    // set the active status flag to true
    adjustedStatus = true;
    // set the already sent flag to true so we don't send another notification for this model
    alreadySentFlags[modelLookupKey] = true;
  }
  // if the model is not in stock and the cached status is true (in stock), set the active status flag to false
  else if (!stockStatusOnSite && alreadySentFlags[modelLookupKey]) {
    // set the active status flag to false
    adjustedStatus = false;
    // set the already sent flag to false so we can send another notification for this model when it comes back in stock
    alreadySentFlags[modelLookupKey] = false;
  }
  // if it's in stock, and we already sent a notification for it, set the active status flag to false so a new notification doesn't get sent
  else {
    adjustedStatus = false;
  }
  // update the active status flag for the model
  stockFlags[modelLookupKey] = adjustedStatus;
}


//------------------------------------------
//------------------------------------------

// Find the key of an object nested inside another (like a model in the greater models collection)

function findKeyOfObject(parent, targetObj) {
  for (let key in parent) {
    if (parent[key] === targetObj) {
      return key;
    }
  }
  return null; // Not found
};


//
// welcome to the end, want a cookie?  ༼ つ ◕_◕ ༽つ🍪
//
