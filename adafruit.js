const axios = require('axios').default;
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

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

// run once right away on startup
update();

// schedule the update to be called every 10 seconds
setInterval(async () => {
  await update();
}, 1000);
