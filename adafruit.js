const axios = require('axios').default;
const jsdom = require('jsdom');
const chalk = require('chalk');
const fs = require('fs');
const { JSDOM } = jsdom;
const { MessageEmbed, Client, Intents, ShardClientUtil } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES], shards: 'auto' });
const clientShardHelper = new ShardClientUtil(client);
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
let configuredGuild; // the discord guild to send the stock status to (gets initialized in the ready event)

// connect to discord
client.login(config.discordBotToken);


// query the Adafruit website for the stock stats of all models of the Raspberry Pi 4 Model B
function checkStockStatus() {
  axios.get('https://www.adafruit.com/product/4295')
    .then(function (response) {
      // on success, parse the HTML response into a DOM object
      const html = response.data;
      const dom = new JSDOM(html);

      // get all the of the HTML list elements that contain the stock status for each model
      const stockList = dom.window.document.querySelector('div.mobile-button-row:nth-child(1) > div:nth-child(1) > ol:nth-child(2)').querySelectorAll('li');

      // gather the stock status of each model (represented as a boolean for being in-stock or not)
      const oneGigModelInStock = stockList[0].textContent.includes('In stock');
      const twoGigModelInStock = stockList[1].textContent.includes('In stock');
      const fourGigModelInStock = true; //stockList[2].textContent.includes('In stock');
      const eightGigModelInStock = stockList[3].textContent.includes('In stock');

      // send the stock status to discord if any of the models are in stock
      if (oneGigModelInStock || twoGigModelInStock || fourGigModelInStock || eightGigModelInStock) {
        // report what is in stock
        console.log(chalk.green(`These models are in STOCK: ${oneGigModelInStock ? '1GB' : ''} ${twoGigModelInStock ? '2GB' : ''} ${fourGigModelInStock ? '4GB' : ''} ${eightGigModelInStock ? '8GB' : ''}`));
        sendToDiscord(oneGigModelInStock, twoGigModelInStock, fourGigModelInStock, eightGigModelInStock);
      }
    })
    .catch(function (error) {
      console.error(chalk.red('An error occurred during the status refresh:\n'), error);
    });
}

// schedule the stock status update to be called at the specified interval
setInterval(() => { checkStockStatus(); }, config.updateIntervalSeconds * 1000);


//**********************************
//*     Discord Event Handlers     *
//**********************************

client.on('ready', () => {
  console.log(chalk.greenBright(`Logged in as ${client.user.tag} in ${client.guilds.cache.size} servers while using ${clientShardHelper.count} shard(s)!`));
  // set the bot's presence
  client.user.setActivity('for Pis!', { type: 'WATCHING' });
  // get the discord guild to send the stock status to
  try {
    configuredGuild = client.guilds.cache.get(config.discordServerID);
  }
  catch (err) {
    console.error(chalk.red(`Error looking up guild with provided ID ${config.discordServerID}\n:`), err);
  }
  // verify and set up the configured discord server if it's not already set up
  setupServer();
  // run a stock status check on startup (will run on configured interval after this)
  checkStockStatus();
});



//**********************************
//*       Utility Functions        *
//**********************************

// function that runs on startup to set up the configured discord server with the necessary roles and notification channel
function setupServer() {
  // first, create the roles roles for the server if they don't exist yet (in RGB cus we're real gamers here)
  const roles = [
    { name: 'Pi4 1GB', color: 'RED' },
    { name: 'Pi4 2GB', color: 'GREEN' },
    { name: 'Pi4 4GB', color: 'BLUE' },
    { name: 'Pi4 8GB', color: 'PURPLE' },
  ];
  roles.forEach(role => {
    if (!configuredGuild.roles.cache.find(r => r.name == role.name)) {
      configuredGuild.roles.create({ name: role.name, color: role.color })
        .then(role => {
          console.log(chalk.green(`Created role: ${role.name}`));
        })
        .catch(err => {
          console.error(chalk.red(`Error creating role: ${role.name}\n:`), err);
        });
    }
  });
  // create the notification channel if an existing one wasn't specified in the config (this will also trigger if configured channel is misspelled or in wrong case in config file)
  if (!configuredGuild.channels.cache.find(c => c.name == config.discordChannelName)) {
    configuredGuild.channels.create({ data: { name: 'pi4-stock-notifications' } })
      .then(channel => {
        // set the notification channel in the config to be this new one (so it can be used in the future)
        config.discordChannelName = 'pi4-stock-notifications';
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        console.log(chalk.green(`You didn't provide a channel name or it wasn't able to be found in the server, so I created and set a new default notification channel for you: ${channel.name}`));
      })
      .catch(err => {
        console.error(
          chalk.red('Error creating default notification channel, either set the correct one in your config or correct what is preventing me from doing it (likely a permissions issue)\n'), err);
      });
  }
  console.log(chalk.greenBright(`Discord server setup complete for ${chalk.cyan(configuredGuild.name)}  Lets go! ⚡⚡⚡`));
  console.log(chalk.green('\nI\'m watching for stock updates now! I\'ll check Adafruit every ' + chalk.cyan(config.updateIntervalSeconds) + ' seconds...\n'));
}


function sendToDiscord(oneGigModelInStock, twoGigModelInStock, fourGigModelInStock, eightGigModelInStock) {

  let mentionRolesMessage = ''; // will be populated with the roles to mention based on status of each model
  console.log(chalk.greenBright('Sending stock status to Discord...'));

  // grab the roles cache from the configured guild
  const rolesCache = configuredGuild.roles.cache;

  // grab the channels cache from the configured guild
  const channelsCache = configuredGuild.channels.cache;

  // create the template embed to send to discord
  const embed = new MessageEmbed()
    .setTitle('Adafruit Raspberry Pi 4 IN STOCK!')
    .setDescription('The following models are in stock:\n')
    .setColor('#00ff00')
    .setThumbnail('https://cdn-shop.adafruit.com/970x728/4292-06.jpg')
    .setFooter({
      text: 'github.com/EthyMoney/Adafruit-Pi4-Stock-Bot',
      iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
    });

  // populate stock fields for all in-stock models where notification is enabled in the config
  if (oneGigModelInStock && config.watch1GigModel) {
    embed.addField('1GB Model', '[BUY IT!](https://www.adafruit.com/product/4295)', true);
    const oneGigRole = rolesCache.find(role => role.name === 'Pi4 1GB');
    mentionRolesMessage += (oneGigRole) ? ` <@!${oneGigRole.id}}> ` : console.error(chalk.red('No 1GB role found!'));
  }
  if (twoGigModelInStock && config.watch2GigModel) {
    embed.addField('2GB Model', '[BUY IT!](https://www.adafruit.com/product/4292)', true);
    const twoGigRole = rolesCache.find(role => role.name === 'Pi4 2GB');
    console.log('no', twoGigRole);
    mentionRolesMessage += (twoGigRole) ? ` <@!${twoGigRole.id}}> ` : console.error(chalk.red('No 2GB role found!'));
  }
  if (fourGigModelInStock && config.watch4GigModel) {
    embed.addField('4GB Model', '[BUY IT!](https://www.adafruit.com/product/4296)', true);
    const fourGigRole = rolesCache.find(role => role.name === 'Pi4 4GB');
    mentionRolesMessage += (fourGigRole) ? ` <@!${fourGigRole}}> ` : console.error(chalk.red('No 4GB role found!'));
  }
  if (eightGigModelInStock && config.watch8GigModel) {
    embed.addField('8GB Model', '[BUY IT!](https://www.adafruit.com/product/4564)', true);
    const eightGigRole = rolesCache.find(role => role.name === 'Pi4 8GB');
    console.log('no', eightGigRole);
    mentionRolesMessage += (eightGigRole) ? ` <@!${eightGigRole}}> ` : console.error(chalk.red('No 8GB role found!'));
  }

  // lookup the configured discord TEXT channel by name and send the embed out to the channel
  const channel = channelsCache.find(channel => channel.name === config.discordChannelName.toString() && channel.type == 'GUILD_TEXT');

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
    if (mentionRolesMessage) {
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
    console.error(chalk.red('No text channel found in server with name: ' + chalk.cyan('"' + config.discordChannelName + '"')), chalk.yellow('check config file! (verify CaSe and spelling)'));
  }
}
