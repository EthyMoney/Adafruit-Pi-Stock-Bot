const axios = require('axios').default;
const jsdom = require('jsdom');
const chalk = require('chalk');
const fs = require('fs');
const { JSDOM } = jsdom;
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS], shards: 'auto' });
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
// connect to discord
client.login(config.discordBotToken);

// query the Adafruit website for the stock stats of all models of the Raspberry Pi 4 (SKU: 4292)
async function update(){
  axios.get('https://www.adafruit.com/product/4292')
    .then(function (response) {
      const html = response.data;
      const dom = new JSDOM(html);
      const stockList = dom.window.document.querySelector('div.mobile-button-row:nth-child(1) > div:nth-child(1) > ol:nth-child(2)');
      const 
      console.log(inStock.textContent);
    })
    .catch(function (error) {
      console.log('Error occurred during request to Adafruit:',error);
    });
}

// schedule the stock status update to be called at the specified interval
setInterval(async () => {
  await checkStockStatus();
}, config.updateIntervalSeconds * 1000);



//**********************************
//*     Discord Event Handlers     *
//**********************************

client.on('ready', () => {
  console.log(chalk.greenBright(`Logged in as ${client.user.tag}!`));
  // run new server setup sequence (creates roles and establishes notification channel)
  //setupServer();
  // set the bot's presence
  client.user.setActivity('for Pis\'s!', { type: 'WATCHING' });
  // run a stock status check on startup (will run on configured interval after this)
  checkStockStatus();
});

// Logs additions of new servers
client.on('guildCreate', guild => {
  console.log(chalk.green('NEW SERVER: ' + chalk.cyan(guild.name)));
});


