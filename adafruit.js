const axios = require('axios').default;
const jsdom = require('jsdom');
const chalk = require('chalk');
const fs = require('fs');
const { JSDOM } = jsdom;
const { Client, Intents, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES], shards: 'auto' });
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// connect to discord
client.login(config.discordBotToken);

// query the Adafruit website for the stock stats of all models of the Raspberry Pi 4 Model B
async function checkStockStatus() {
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
      const fourGigModelInStock = stockList[2].textContent.includes('In stock');
      const eightGigModelInStock = stockList[3].textContent.includes('In stock');
      console.log(oneGigModelInStock, twoGigModelInStock, fourGigModelInStock, eightGigModelInStock);

      // send the stock status to discord if any of the models are in stock
      if (oneGigModelInStock || twoGigModelInStock || fourGigModelInStock || eightGigModelInStock) {
        if(config.enableDiscordBot){
          sendToDiscord(oneGigModelInStock, twoGigModelInStock, fourGigModelInStock, eightGigModelInStock);
        }
        if (config.enableSlackBot){
          sendToSlack(oneGigModelInStock, twoGigModelInStock, fourGigModelInStock, eightGigModelInStock)
        }
      }
    })
    .catch(function (error) {
      console.log('Error occurred during request to Adafruit:', error);
    });
}

// schedule the stock status update to be called at the specified interval
setInterval(async () => {
  await checkStockStatus();
}, config.updateIntervalSeconds * 1000);

//**********************************
//*     Slack Stuff
//**********************************

OneGBInStock().catch(err => console.log(err));
TwoGBInStock().catch(err => console.log(err));
FourGBInStock().catch(err => console.log(err));
EightGBInStock().catch(err => console.log(err));

async function OneGBInStock() {
  const url = 'https://slack.com/api/chat.postMessage';
  const res = await axios.post(url, {
    channel: config.slackChannel1GB,
    username: 'ADAFRUIT RASPBERRY PI 1GB IN STOCK',
    link_names: true,
    text: '@channel ADAFRUIT HAS 1GB RASPBERRY PI MODELS IN STOCK <https://www.adafruit.com/product/4295|BUY IT>'
  }, { headers: { authorization: `Bearer ${config.slackBotToken}` } });

  console.log('Done', res.data)
}

async function TwoGBInStock() {
  const url = 'https://slack.com/api/chat.postMessage';
  const res = await axios.post(url, {
    channel: config.slackChannel2GB,
    username: 'ADAFRUIT RASPBERRY PI 2GB IN STOCK',
    link_names: true,
    text: '@channel ADAFRUIT HAS 2GB RASPBERRY PI MODELS IN STOCK <https://www.adafruit.com/product/4292|BUY IT>'
  }, { headers: { authorization: `Bearer ${config.slackBotToken}` } });

  console.log('Done', res.data)
}

async function FourGBInStock() {
  const url = 'https://slack.com/api/chat.postMessage';
  const res = await axios.post(url, {
    channel: config.slackChannel4GB,
    username: 'ADAFRUIT RASPBERRY PI 4GB IN STOCK',
    link_names: true,
    text: '@channel ADAFRUIT HAS 4GB RASPBERRY PI MODELS IN STOCK <https://www.adafruit.com/product/4296|BUY IT>'
  }, { headers: { authorization: `Bearer ${config.slackBotToken}` } });

  console.log('Done', res.data)
}

async function EightGBInStock() {
  const url = 'https://slack.com/api/chat.postMessage';
  const res = await axios.post(url, {
    channel: config.slackChannel8GB,
    username: 'ADAFRUIT RASPBERRY PI 8GB IN STOCK',
    link_names: true,
    text: '@channel ADAFRUIT HAS 8GB RASPBERRY PI MODELS IN STOCK <https://www.adafruit.com/product/4564|BUY IT>'
  }, { headers: { authorization: `Bearer ${config.slackBotToken}` } });

  console.log('Done', res.data)
}




//**********************************
//*     Discord Event Handlers     *
//**********************************

client.on('ready', () => {
  console.log(chalk.greenBright(`Logged in as ${client.user.tag}!`));
  // set the bot's presence
  client.user.setActivity('for Pis\'s!', { type: 'WATCHING' });
  // run a stock status check on startup (will run on configured interval after this)
  checkStockStatus();
});

// Logs additions of new servers
client.on('guildCreate', guild => {
  console.log(chalk.green('NEW SERVER: ' + chalk.cyan(guild.name)));
  setupServer(guild);
});


//**********************************
//*       Utility Functions        *
//**********************************

function setupServer() {
// first, create the roles roles for the server
  createRoles();
  // create the notification channel
  createNotificationChannel();
}

function sendToSlack(){
  if (oneGigModelInStock && config.watch1GigModel){
    OneGBInStock();
  }
  if (twoGigModelInStock && config.watch2GigModel){
    TwoGBInStock();
  }
  if(fourGigModelInStock && config.watch4GigModel){
    FourGBInStock();
  }
  if(eightGigModelInStock && config.watch8GigModel){
    EightGBInStock();
  }
}



function sendToDiscord(){
  let mentionRolesMessage = ''; // will be populated with the roles to mention based on status of each model

  // create the template embed to send to discord
  const embed = new MessageEmbed()
    .setTitle('Adafruit Raspberry Pi 4 IN STOCK!')
    .setDescription('The following models are in stock:\n')
    .setColor('#00ff00')
    .setThumbnail('https://cdn-shop.adafruit.com/970x728/4564-00.jpg')
    .setFooter({
      text: 'Check Me Out on GitHub!',
      iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      url: 'https://github.com/EthyMoney/Adafruit-Pi4-Stock-Bot'
    });

  // populate stock fields for all in-stock models where notification is enabled in the config
  if (oneGigModelInStock && config.watch1GigModel) {
    embed.addField('1GB Model', '[BUY IT!](https://www.adafruit.com/product/4295)', true);
    const oneGigRoleID = client.guilds.cache.get(config.discordServerID).roles.cache.find(role => role.name === 'Pi4 1GB').id;
    mentionRolesMessage += (oneGigRoleID) ? ` <@!${oneGigRoleID}}> ` : console.log('No 1GB role found!');
  }
  if (twoGigModelInStock && config.watch2GigModel) {
    embed.addField('2GB Model', '[BUY IT!](https://www.adafruit.com/product/4292)', true);
    const twoGigRoleID = client.guilds.cache.get(config.discordServerID).roles.cache.find(role => role.name === 'Pi4 1GB').id;
    mentionRolesMessage += (twoGigRoleID) ? ` <@!${twoGigRoleID}}> ` : console.log('No 2GB role found!');
  }
  if (fourGigModelInStock && config.watch4GigModel) {
    embed.addField('4GB Model', '[BUY IT!](https://www.adafruit.com/product/4296)', true);
    const fourGigRoleID = client.guilds.cache.get(config.discordServerID).roles.cache.find(role => role.name === 'Pi4 1GB').id;
    mentionRolesMessage += (fourGigRoleID) ? ` <@!${fourGigRoleID}}> ` : console.log('No 4GB role found!');
  }
  if (eightGigModelInStock && config.watch8GigModel) {
    embed.addField('8GB Model', '[BUY IT!](https://www.adafruit.com/product/4564)', true);
    const eightGigRoleID = client.guilds.cache.get(config.discordServerID).roles.cache.find(role => role.name === 'Pi4 1GB').id;
    mentionRolesMessage += (eightGigRoleID) ? ` <@!${eightGigRoleID}}> ` : console.log('No 8GB role found!');
  }

  // lookup the configured discord channel ID by name and send the embed out to the channel
  const channel = client.channels.cache.find(channel => channel.name === config.discordChannelName);
  channel.send({ embeds: [embed] })
    .catch(function (reject) {
      console.log(chalk.red(`Error sending message to ${channel.guild.name} with promise rejection: ${reject}`));
    });

  // also mention all the relevant users that have the applicable model roles
  channel.send(mentionRolesMessage.trim());
}
