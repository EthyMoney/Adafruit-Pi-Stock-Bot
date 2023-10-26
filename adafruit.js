/*
 * ------------------------------------------------------------------------
 *
 *       _____ _      _____ _             _        ____        _   
 *      |  __ (_|    / ____| |           | |      |  _ \      | |  
 *      | |__) _    | (___ | |_ ___   ___| | __   | |_) | ___ | |_ 
 *      |  ___| |    \___ \| __/ _ \ / __| |/ /   |  _ < / _ \| __|
 *      | |   | |    ____) | || (_) | (__|   <    | |_) | (_) | |_ 
 *      |_|   |_|   |_____/ \__\___/ \___|_|\_\   |____/ \___/ \__|
 *
 *
 *
 * Author:      Logan S. ~ EthyMoney#5000(Discord) ~ EthyMoney(GitHub)
 * Program:     Adafruit Raspberry Pi Stock Bot
 * GitHub:      https://github.com/EthyMoney/Adafruit-Pi4-Stock-Bot
 *
 * Discord and Slack bot that sends alerts of stock of the Raspberry Pi 4 on Adafruit.com
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

import { Client, GatewayIntentBits, ShardClientUtil, EmbedBuilder, ChannelType, PermissionFlagsBits, Colors } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
import axios from 'axios';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';
import fs from 'fs';
const clientShardHelper = new ShardClientUtil(client);
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
let configuredGuild;       // the discord guild to send the stock status to (gets initialized in the ready event)

// flags indicating current stock status of each model (used to prevent sending the same in-stock messages multiple times)
let pi4ModelBOneGigActive = false;
let pi4ModelBTwoGigActive = false;
let pi4ModelBFourGigActive = false;
let pi4ModelBEightGigActive = false;
let zeroActive = false;
let zeroWActive = false;
let zero2WActive = false;
let pi5FourGigActive = false;
let pi5EightGigActive = false;

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
  console.log(chalk.green(chalk.yellow('\n[BOT START]') + ' I\'m watching for stock updates now! I\'ll check Adafruit every ' + chalk.cyan(config.generalSettings.updateIntervalSeconds) + ' seconds...\n'));
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
  console.log(chalk.greenBright(`Logged in as ${client.user.tag} in ${client.guilds.cache.size} servers while using ${clientShardHelper.count} shard(s)!`));
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

  // proceed to make a query to the Pi 4 product page and download the source HTML
  axios.get('https://www.adafruit.com/product/4295')
    .then(function (response) {
      // on success, select the HTML from the response and parse it into a DOM object
      const html = response.data;
      const dom = new JSDOM(html);

      // query the DOM to get all of the HTML list <li> elements that contain the stock status for each model
      const stockList = dom.window.document.querySelector('div.mobile-button-row:nth-child(1) > div:nth-child(1) > ol:nth-child(2)').querySelectorAll('li');

      // gather the stock status of each model (represented as a boolean for being in-stock or not)
      // check if the text doesn't contain the text "Out of Stock" (will be showing the price instead if it's actually in stock)
      let pi4ModelBOneGigModelInStock = stockList[0].textContent.toLowerCase().indexOf('out of stock') === -1;
      let pi4ModelBTwoGigModelInStock = stockList[1].textContent.toLowerCase().indexOf('out of stock') === -1;
      let pi4ModelBFourGigModelInStock = stockList[2].textContent.toLowerCase().indexOf('out of stock') === -1;
      let pi4ModelBEightGigModelInStock = stockList[3].textContent.toLowerCase().indexOf('out of stock') === -1;

      // verify that the stock status of each model has changed since the last check and update the active flags (prevents duplicate notifications)
      checkForNewStock(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock, (adjustedOneGig, adjustedTwoGig, adjustedFourGig, adjustedEightGig) => {
        pi4ModelBOneGigModelInStock = adjustedOneGig;
        pi4ModelBTwoGigModelInStock = adjustedTwoGig;
        pi4ModelBFourGigModelInStock = adjustedFourGig;
        pi4ModelBEightGigModelInStock = adjustedEightGig;
      });

      // send the stock status to discord and/or slack if any of the models are in stock
      if (pi4ModelBOneGigModelInStock || pi4ModelBTwoGigModelInStock || pi4ModelBFourGigModelInStock || pi4ModelBEightGigModelInStock) {
        console.log(chalk.yellowBright(`WE GOT STOCK! : ${pi4ModelBOneGigModelInStock ? '1GB' : ''} ${pi4ModelBTwoGigModelInStock ? '2GB' : ''} ${pi4ModelBFourGigModelInStock ? '4GB' : ''} ${pi4ModelBEightGigModelInStock ? '8GB' : ''}`));
        if (config.discord.enableBot) {
          sendToDiscord(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock);
        }
        if (config.slack.enableBot) {
          sendToSlack(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock);
        }
      }
    })
    .catch(function (error) {
      console.error(chalk.red('An error occurred during the status refresh:\n'), error);
    });
}


//------------------------------------------
//------------------------------------------

// this function handles verifying the servers, channels, and roles for discord, then sending the actual notification message out
// this will send *one* notification message embed that contains all models that are in stock, rather than separate messages for each model (like the slack function does)

function sendToDiscord(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock) {
  console.log(chalk.greenBright('Sending stock status to Discord...'));
  let mentionRolesMessage = ''; // will be populated with the roles to mention based on status of each model
  // grab the roles and channels cache from the configured guild
  const rolesCache = configuredGuild.roles.cache;
  const channelsCache = configuredGuild.channels.cache;

  // create the template embed to send to discord
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('Adafruit Raspberry Pi 4 IN STOCK!')
    .setDescription('The following models are in stock:\n')
    .setThumbnail('https://cdn-shop.adafruit.com/970x728/4292-06.jpg')
    .setTimestamp()
    .setFooter({
      text: 'github.com/EthyMoney/Adafruit-Pi4-Stock-Bot',
      iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
    });

  // populate stock fields for all in-stock models where notification is enabled in the config
  if (pi4ModelBOneGigModelInStock && config.modelsSelection.pi4_modelB_1GB) {
    embed.addFields({ name: '1GB Model', value: '[BUY IT!](https://www.adafruit.com/product/4295)', inline: true })
    const oneGigRole = rolesCache.find(role => role.name === 'Pi4 1GB');
    mentionRolesMessage += (oneGigRole) ? ` ${oneGigRole} ` : console.error(chalk.red('No 1GB role found!'));
  }
  if (pi4ModelBTwoGigModelInStock && config.modelsSelection.pi4_modelB_2GB) {
    embed.addFields({ name: '2GB Model', value: '[BUY IT!](https://www.adafruit.com/product/4292)', inline: true })
    const twoGigRole = rolesCache.find(role => role.name === 'Pi4 2GB');
    mentionRolesMessage += (twoGigRole) ? ` ${twoGigRole} ` : console.error(chalk.red('No 2GB role found!'));
  }
  if (pi4ModelBFourGigModelInStock && config.modelsSelection.pi4_modelB_4GB) {
    embed.addFields({ name: '4GB Model', value: '[BUY IT!](https://www.adafruit.com/product/4296)', inline: true })
    const fourGigRole = rolesCache.find(role => role.name === 'Pi4 4GB');
    mentionRolesMessage += (fourGigRole) ? ` ${fourGigRole} ` : console.error(chalk.red('No 4GB role found!'));
  }
  if (pi4ModelBEightGigModelInStock && config.modelsSelection.pi4_modelB_8GB) {
    embed.addFields({ name: '8GB Model', value: '[BUY IT!](https://www.adafruit.com/product/4564)', inline: true })
    const eightGigRole = rolesCache.find(role => role.name === 'Pi4 8GB');
    mentionRolesMessage += (eightGigRole) ? ` ${eightGigRole} ` : console.error(chalk.red('No 8GB role found!'));
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

async function sendToSlack(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock) {
  console.log(chalk.greenBright('Sending stock status to Slack...'));
  const url = 'https://slack.com/api/chat.postMessage';
  const authorizationHeader = { headers: { authorization: `Bearer ${config.slack.token}` } };
  if (pi4ModelBOneGigModelInStock && config.modelsSelection.pi4_modelB_1GB) {
    const channel = config.slack.channel_pi4_modelB_1GB;
    const username = 'PI4 Model B 1GB IN STOCK';
    const messageText = '@channel The 1GB model is in stock on Adafruit! <https://www.adafruit.com/product/4295|BUY IT>';
    postMessage(channel, username, messageText, '1GB');
  }
  if (pi4ModelBTwoGigModelInStock && config.modelsSelection.pi4_modelB_2GB) {
    const channel = config.slack.channel_pi4_modelB_2GB;
    const username = 'PI4 Model B 2GB IN STOCK';
    const messageText = '@channel The 2GB model is in stock on Adafruit! <https://www.adafruit.com/product/4292|BUY IT>';
    postMessage(channel, username, messageText, '2GB');
  }
  if (pi4ModelBFourGigModelInStock && config.modelsSelection.pi4_modelB_4GB) {
    const channel = config.slack.channel_pi4_modelB_4GB;
    const username = 'PI4 Model B 4GB IN STOCK';
    const messageText = '@channel The 4GB model is in stock on Adafruit! <https://www.adafruit.com/product/4296|BUY IT>';
    postMessage(channel, username, messageText, '4GB');
  }
  if (pi4ModelBEightGigModelInStock && config.modelsSelection.pi4_modelB_8GB) {
    const channel = config.slack.channel_pi4_modelB_8GB;
    const username = 'PI4 Model B 8GB IN STOCK';
    const messageText = '@channel The 8GB model is in stock on Adafruit! <https://www.adafruit.com/product/4564|BUY IT>';
    postMessage(channel, username, messageText, '8GB');
  }

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
  if (config.modelsSelection.pi4_modelB_1GB) roles.push({ name: 'Pi4 1GB', color: Colors.Red });
  if (config.modelsSelection.pi4_modelB_2GB) roles.push({ name: 'Pi4 2GB', color: Colors.Green });
  if (config.modelsSelection.pi4_modelB_4GB) roles.push({ name: 'Pi4 4GB', color: Colors.Blue });
  if (config.modelsSelection.pi4_modelB_8GB) roles.push({ name: 'Pi4 8GB', color: Colors.Purple });

  // create the roles in the server if they don't exist yet
  roles.forEach(role => {
    if (!configuredGuild.roles.cache.find(r => r.name == role.name)) {
      configuredGuild.roles.create({
        name: role.name,
        color: role.color,
        reason: 'Auto-created by Pi4 Stock Bot for stock notifications',
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
      name: 'pi4-stock-notifications',
      type: ChannelType.GuildText,
      reason: 'Auto-created by Pi4 Stock Bot for stock notifications',
      permissionOverwrites: [
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
        },
      ],
    })
      .then(channel => {
        // set the notification channel in the config to be this new one (so it can be used in the future)
        config.discord.channelName = 'pi4-stock-notifications';
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
  console.log(chalk.green('\nI\'m watching for stock updates now! I\'ll check Adafruit every ' + chalk.cyan(config.generalSettings.updateIntervalSeconds) + ' seconds...\n'));
}


//------------------------------------------
//------------------------------------------

// check new statuses against the old cached ones to see if any models have come in stock that weren't previously
// this is done so we don't send another notification for a model that has already had a notification sent for it
// the active status flags get reset when the models go out of stock again so that the next restock will be captured

function checkForNewStock(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock, cb) {
  // first, ignore if in stock but has already had notification sent (active)
  if (pi4ModelBOneGigModelInStock && pi4ModelBOneGigActive) {
    pi4ModelBOneGigModelInStock = false;
  }
  else {
    // in stock and wasn't previously, send a notification and update the active status flag
    if (pi4ModelBOneGigModelInStock && !pi4ModelBOneGigActive) {
      pi4ModelBOneGigActive = true;
    }
    if (!pi4ModelBOneGigModelInStock && pi4ModelBOneGigActive) {
      pi4ModelBOneGigActive = false;
    }
  }
  if (pi4ModelBTwoGigModelInStock && pi4ModelBTwoGigActive) {
    pi4ModelBTwoGigModelInStock = false;
  }
  else {
    if (pi4ModelBTwoGigModelInStock && !pi4ModelBTwoGigActive) {
      pi4ModelBTwoGigActive = true;
    }
    if (!pi4ModelBTwoGigModelInStock && pi4ModelBTwoGigActive) {
      pi4ModelBTwoGigActive = false;
    }
  }
  if (pi4ModelBFourGigModelInStock && pi4ModelBFourGigActive) {
    pi4ModelBFourGigModelInStock = false;
  }
  else {
    if (pi4ModelBFourGigModelInStock && !pi4ModelBFourGigActive) {
      pi4ModelBFourGigActive = true;
    }
    if (!pi4ModelBFourGigModelInStock && pi4ModelBFourGigActive) {
      pi4ModelBFourGigActive = false;
    }
  }
  if (pi4ModelBEightGigModelInStock && pi4ModelBEightGigActive) {
    pi4ModelBEightGigModelInStock = false;
  }
  else {
    if (pi4ModelBEightGigModelInStock && !pi4ModelBEightGigActive) {
      pi4ModelBEightGigActive = true;
    }
    if (!pi4ModelBEightGigModelInStock && pi4ModelBEightGigActive) {
      pi4ModelBEightGigActive = false;
    }
  }

  // return the updated statuses
  cb(pi4ModelBOneGigModelInStock, pi4ModelBTwoGigModelInStock, pi4ModelBFourGigModelInStock, pi4ModelBEightGigModelInStock);
}


//
// welcome to the end, want a cookie?  ༼ つ ◕_◕ ༽つ🍪
//
