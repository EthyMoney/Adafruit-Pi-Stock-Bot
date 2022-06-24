# Adafruit-Pi4-Stock-Bot
A simple Discord bot that that checks the stock status of all the Raspberry Pi 4 models on Adafruit and sends a message to a Discord channel when one is in stock.

# Why?
Because Adafruit's stock notification system sucks. It's a FIFO queue where the whole queue gets cleared any time any stock comes in. This means that your notification subscription will get removed even if your notification never got triggered during restock because the restock quantity was smaller than the queue size. This means that every time any restock happens at all, even its small and doesn't trigger your notification, you'll have to go back and re-subscribe to the notifications. This bot removes the need for that by allowing you to quickly get a @mention in your Discord server every time there is a restock reliably.

