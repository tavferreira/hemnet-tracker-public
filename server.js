import express from 'express';
import mongoose from 'mongoose';
import { Bot } from 'grammy';
import config from 'config';
import queryString from 'query-string';
// eslint-disable-next-line import/extensions
import scrape from './scrapers/hemnet.js';

const botToken = process.env.BOT_TOKEN;
const searches = config.get('Default.searches');

const bot = new Bot(botToken);
bot.start();

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/hemnet-tracker';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const Apartment = mongoose.model('Apartment', {
  id: String,
  link: String,
  address: String,
  location: String,
  img: String,
  price: Number,
  avgift: Number,
  size: Number,
  rooms: Number,
  squareMeterPrice: Number,
  search: String,
  date: Date,
});

//   PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

const storeApartment = async (row, searchId) => {
  await new Apartment({ ...row, search: searchId, date: Date() }).save()
    // eslint-disable-next-line no-console
    .then((res) => console.log(`Apartment with id ${res.id} was correctly stored in the database.`))
    // eslint-disable-next-line no-console
    .catch((error) => console.log(`Failed to store apartment in the database: ${error.message}.`));
};

const sendDelayedMessage = (id, apartment, delay) => {
  const message = `<b>Address:</b> ${apartment.address}\n<b>Location:</b> ${apartment.location}\n<b>Price:</b> ${apartment.price} kr\n<b>Rooms:</b> ${apartment.rooms}\n<b>Avgift:</b> ${apartment.avgift} kr/month\n<b>Size:</b> ${apartment.size} m²\n<b>Price per m²:</b> ${apartment.squareMeterPrice} kr/m²\n<b><a href="${apartment.link}">Link to Hemnet</a></b>`;

  setTimeout(
    async () => bot.api.sendMessage(id, message, { parse_mode: 'HTML' })
      .then((res) => {
        // eslint-disable-next-line no-console
        console.log(`Sent message with id ${res.message_id} to group ${res.chat.title}.`);
        // eslint-disable-next-line no-console
        console.log(`Apartment URL: ${apartment.link}`);
      })
      // eslint-disable-next-line no-console
      .catch((error) => console.log(`Failed to send message: ${error.message}.`)),
    5000 * delay,
  );
};

const buildQuery = (url, query) => queryString.stringifyUrl({ url, query });

const fetchApartments = async (search) => {
  // eslint-disable-next-line no-console
  console.log(`Fetching apartments in ${search.location}...`);

  const data = await scrape(buildQuery('https://www.hemnet.se/bostader', search.query));

  // eslint-disable-next-line no-console
  console.log(`Fetched apartments in ${search.location}!`);

  const fetchedApartmentsExist = [];

  data.forEach(async (row, index) => {
    const apartmentExists = await Apartment.exists({ id: row.id });
    fetchedApartmentsExist.push(apartmentExists);

    if (!apartmentExists) {
      storeApartment(row, search.location);
      sendDelayedMessage(search.chatId, row, index);
    }

    if (index === data.length - 1) {
      const newOnes = fetchedApartmentsExist.filter((exist) => exist === false);
      // eslint-disable-next-line no-console
      console.log(`Fetched ${fetchedApartmentsExist.length} apartment(s). ${newOnes.length > 0 ? `Including ${newOnes.length} new one(s).` : 'No new ones.'}`);
    }
  });
};

const fetch = (search, index) => setTimeout(() => fetchApartments(search), index * 10000);

searches
// Run scrapers for Sweden only, for now
  .filter((search) => search.country === 'SE')
  .map((search, index) => {
  // Initial fetch
    fetch(search, index);

    // Fetch regularly
    return setInterval(() => fetch(search, index), 1800000);
  });

// Start the server
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});
