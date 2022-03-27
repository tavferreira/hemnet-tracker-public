import puppeteer from 'puppeteer';

const scrape = async (url) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 1000 });
  await page.goto(url, { waitUntil: 'load', timeout: 0 });

  const data = await page.evaluate(() => {
    const list = [];
    const items = document.querySelectorAll('li.js-normal-list-item');
    items.forEach((item) => {
      const link = item.querySelector('a.js-listing-card-link').href;
      const attributes = item.querySelector('div.listing-card__attributes-container div').innerText.split('\n');

      list.push({
        id: link.match(/\d+$/)[0],
        link,
        address: item.querySelector('h2.listing-card__street-address').innerText,
        location: item.querySelector('span.listing-card__location-name').innerText,
        // TODO: implement logic for lazy loading
        img: item.querySelector('.listing-card__image').src,
        price: parseInt(attributes[0].replace(/\s/g, ''), 10) || 0,
        size: parseFloat(attributes[1].replace(/,/, '.')) || 0,
        rooms: parseInt(attributes[2], 10) || 0,
        avgift: parseInt(item.querySelector('div.listing-card__attribute--fee').innerText.replace(/\s/g, ''), 10) || 0,
        squareMeterPrice: parseInt(item.querySelector('div.listing-card__attribute--square-meter-price').innerText.replace(/\s/g, ''), 10) || 0,
      });
    });

    return list;
  });

  await browser.close();

  return data;
};

export default scrape;
