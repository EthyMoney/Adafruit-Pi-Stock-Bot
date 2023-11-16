<div align="center">
  
# Adafruit Raspberry Pi Stock Alert Bot

  <a href="">[![GitHub tag](https://img.shields.io/github/tag/EthyMoney/Adafruit-Pi-Stock-Bot?include_prereleases=&sort=semver&color=blue)](https://github.com/EthyMoney/Adafruit-Pi-Stock-Bot/releases/)</a>
  <a href="">[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/EthyMoney/Adafruit-Pi-Stock-Bot/blob/main/LICENSE)</a>
  <a href="">[![issues - Adafruit-Pi-Stock-Bot](https://img.shields.io/github/issues/EthyMoney/Adafruit-Pi-Stock-Bot)](https://github.com/EthyMoney/Adafruit-Pi-Stock-Bot/issues)</a>
  <a href="">[![Made For - Discord](https://img.shields.io/static/v1?label=Made+For&message=Discord&color=%235865F2&logo=discord)](https://discord.com/)</a>
  <a href="">[![Made For - Slack](https://img.shields.io/static/v1?label=Made+For&message=Slack&color=%234A154B&logo=slack&logoColor=%23E01E5A)](https://slack.com/)</a>
  <a href="">[![Node.js - >=20.9.0](https://img.shields.io/badge/Node.js->=20.9.0-brightgreen?logo=node.js)](https://nodejs.org/en/)</a>
  <a href="">[![Discord.js - 14.14.1](https://img.shields.io/badge/Discord.js-14.14.1-blue?logo=discord&logoColor=https%3A%2F%2Fdiscord.js.org%2F%23%2F)](https://discord.js.org/)</a>
  
</div>

<br>
<p align="center">
  <img src="https://imgur.com/ndaGhdY.png" alt="Alert Icon" width="20%" height="auto">
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://i.imgur.com/PRQKkJh.png" alt="Raspberry Pi 5 Model B" width="45%" height="auto">
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://imgur.com/ndaGhdY.png" alt="Alert Icon" width="20%" height="auto">
</p>
<br>

<div align="center">

<a href="https://www.digitalocean.com/?refcode=5c02403910e5&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" alt="DigitalOcean Referral Badge" width="20%" height="auto"/></a>

</div>

## What This Is

A simple Discord and Slack bot that checks the stock status of selected Raspberry Pi models on Adafruit and sends a message to a Discord/Slack channel when one comes in stock. This bot is designed to be self-hosted and run for use in your own Discord server or Slack workspace.

## Why?

Because Adafruit's stock notification system is lacking. It's a FIFO queue that does not reliably trigger notifications in a timely manner and sometimes removes your notification entirely even when you never got one! This means that every time any restock happens at all, even if it's small and doesn't trigger your notification, you'll likely miss it AND have to go back and re-subscribe to the notifications. This bot removes the need for that by allowing you to quickly get a @mention in your Discord server or a message in your Slack channels every time there is a restock without delay!

## How It Works

On a set interval, the bot will query Adafruit's product pages for the models you have enabled to watch and will check for the stock statuses changing to in stock. If one or more of the models come in stock, a notification is sent out to the configured Discord server channel with accompanying @role mentions. For Slack, it will just send the notification to the configured channel since Slack doesn't have a roles system like Discord does. In either case, the notification will contain a direct link to the page of the SKU that's in stock so you can buy it right away. Stock statuses are tracked between update intervals, so you won't have to get spammed with the same notification on every check if the bot has already sent a notification for a current stock event of a particular model. This is handled in a smart way to ensure you always get *one* notification every time any model comes in stock, while never missing a restock!

## How to Set Up and Run

* Install [Node.js](https://nodejs.org) LTS edition for your specific environment using the site or a package manager. Node.js is supported basically everywhere which allows this bot to be multi-platform!
* Clone the repo, then run `npm install` from a terminal in the root project folder. This installs all necessary dependencies for you.
* Follow the below instructions for setting up your very own Discord or Slack bot (or even both!). Be sure to complete the [final steps](#final-configuration-steps-and-bot-startup) as well once you finish the Discord and Slack specific instructions.

### Discord Bot Set Up

* Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click "New Application" at the top.
* Give your bot application a name and hit create.
* From the left side navigation column, select the "Bot" tab (has a puzzle piece icon), click "Add Bot" and confirm with the "Yes, do it!" button.
* From here, go ahead and set a username and avatar for your new bot. You'll want to uncheck the "Public Bot" option as well.
* Now you need to make an invite link so you can add the bot to your server. From the left side navigation column, select the "General Information" tab.
* Copy your "Application ID" shown there. You will put this into the following template link so it can identify your bot.
* Use this invite link as your template: `https://discord.com/oauth2/authorize?client_id=APPLICATION_ID_HERE&scope=bot&permissions=412652817488`
* Replace `APPLICATION_ID_HERE` in that link with your actual application ID you copied earlier.
* Now go ahead and use that link to add your bot to your server. Be sure to leave all permissions checked! These are pre-configured for you.
* It's important that you add the bot to your server before you proceed. The bot program expects to already have access to the server when it starts up.
* Now, you need to configure the `config.json` file for your use. This file is located in the `/config` directory. Open the file in a text editor.
* Enter your bot's token under the `token` field of the discord section of the config. Your token can be found back in the developer portal under the "Bot" tab again. Click on "Reset Token" and copy it. KEEP THIS SAFE AND PRIVATE!
* Now enter the ID number of the server you added the bot to earlier for the `serverID` field. You can get from within Discord by right clicking on the server icon (with developer options enabled in settings)
* Now enter the name of the channel in your server where you'd like to have updates posted for the `channelName` field. You can leave this blank if you want the bot to create a new one for you (will be named pi-stock-notifications)

### Slack Bot Set Up

* Go to the [Slack App API](https://api.slack.com/) and click "Create an app", then select "From scratch" in the popup that appears.
* Give your Slack App a name and select your workspace you'd like to add the bot to, then click "Create App".
* Under the "Add features and functionality" section select the "Bots" option.
* Along the left side navigation under the "Features" section, select "OAuth & Permissions". Once selected, scroll down to the "Scopes" section.
* Under "Bot Token Scopes", click the "Add an OAuth Scope" button and then add these scopes:
  * "chat:write",
  * "links:write",
  * "channels:manage",
  * "chat:write.customize",
  * "chat:write.public".
* Now scroll back up and click the "Install to Workspace" button. Allow the app access to your workspace using the "Allow" button on the screen that appears.
* You will now be shown a page with your bot token. Copy the "Bot User OAuth Token" and paste it in the `token` field of the slack section in the `config.json`. KEEP THIS TOKEN SAFE AND PRIVATE!
* Create at least one channel for the bot to post into. Put the name of the channel into the `config.json` in the `channelName` field of the slack section.

### Final Configuration Steps and Bot Startup

* In the `config.json` file:
  * Indicate whether you are using the Discord bot, Slack bot, or even both, using the `enableBot` option in the Discord and Slack sections of the config file. These are both on(true) by default, adjust them accordingly if needed. Remember, you can't start without at least one on, but why would you try that anyway?
  * Enter the update interval in seconds for `updateIntervalSeconds` (default is 60 seconds).
  * Set any models you don't wish to monitor to false under the `modelsSelection` section (all are enabled(true) by default).
  * Choose whether or not you want to have sleep mode enabled using `enableSleepMode`. Sleep mode just prevents the bot from querying Adafruit overnight when restocks aren't happening (this is enabled(true) by default). Prevents needless spam to Adafruit's servers while they are closed.
* Yay! You are now ready to start your bot! Go ahead and run `npm start` in a terminal of the project directory to launch the bot!.
* If you are using the Discord bot, be sure to make use of the roles that the bot created! Add them to yourself and others so you get mentioned when stock comes in.
* That's it! I hope you get the shiny new Pi you've been looking for! :)

### Optional Final Configuration

* You can daemonize the app using PM2. A PM2 process definition file has been provided to do so. Simply run `pm2 start process.json` in the project directory to start the bot as a daemon. You can also use the `pm2 monit` command to monitor the bot's status and log output. Starting the bot this way will allow it to run in the background and also restart automatically if it crashes for any reason. If on Linux, you can use the `pm2 startup` command to have the bot start on system boot. See the [PM2 docs](https://pm2.keymetrics.io/docs/usage/quick-start/) for more info. Highly recommended using this run method if you want more a of "set it and forget it" experience. It's great!

### Running as Docker Container

If you prefer Docker, it is supported to deploy this bot as a container. A Docker Hub repository is maintained and updated with each release of the bot. You can find it [here](https://hub.docker.com/r/ultimate360/adafruit-pi-stock-bot).<br>

To run the container using the latest release, you can use the following command:

* `docker run -v adafruit-pi-bot:/usr/src/app/config:rw -d ultimate360/adafruit-pi-stock-bot`

The /config directory is added as volume so you can access config files from your host. As written, it uses the default volumes location and names it adafruit-pi-bot. You can change this name or customize the mount path to whatever you want, just be sure to update the command above to match.<br>

Once the container starts, you will notice it immediately exits. This is because the config file is missing values that you need to go fill in. Use the above normal instructions to fill in the config.json file located at the new volume mount we created. Once you have done this, you can restart the container and it will run normally.<br>

If you wish to build the container yourself, like maybe if you want the latest commits in the branch above the last release, or you made your own modifications, there are npm commands to help you do this. You can run `npm run docker-build` to build the container, and `npm run docker-run` to run it. These scripts utilize pre-configured settings through a dockerfile and volume mounting of configuration files.<br>

### Customizing the Notification Messages and Adding New Models

You may notice another file sitting in the /config directory, named `models.json`. The file contains all of the metadata the bot uses for the stock notifications. You can edit this file to change the notification messages to your liking, whether that be new descriptions, titles, names, links, images, etc. You can also add new models to the file if you want to monitor more than the default models. The bot will automatically pick up any changes you make to this file and use them. Just be sure to follow the same format as the other default models in the file and remember to add them as modelSelections options to the `config.json` with the name matching what you put for `configFileName` in the models file. Enjoy!

<br>

## Here's What the Notification Messages Look Like

<p align="center">
  <img src="https://i.imgur.com/PdXCD0g.png" alt="Discord Message Multi" width="44%" height="auto">
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://i.imgur.com/T6EFYXo.png" alt="Discord Message Single" width="50%" height="auto">
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://i.imgur.com/QOiO6RL.png" alt="Slack Message" width="58%" height="auto">
</p>
<br>

## One More Thing

Like this bot? Show some support! Give me a star on this repo and share it with your friends! You can also sign up for Digital Ocean to host this bot or whatever else on, I get a small referal kickback when you use the blue Digital Ocean button at the top of this page :)<br>
Contributions are welcome and encouraged! Feel free to open a pull request or issue for things you notice or want to fix/improve.<br>
If you want to chat, you can find me in the support Discord server of my other popular bot that I made called TsukiBot, [Join Here!](https://discord.gg/t7Ka9ycEyD)
