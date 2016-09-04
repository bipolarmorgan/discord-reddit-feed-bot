'use strict';

require('dotenv').config();

const Discord = require('discord.js');
const request = require('request');
const entities = require('entities');
const logger = require('./logger');

const bot = new Discord.Client();
bot.login(process.env.DISCORD_TOKEN);
logger.info('Initialized');

bot.on('ready', () => {
  bot.user.setStatus('online', `Spamming F5 on /r/${process.env.SUBREDDIT}`).then(logger.info('Changed status!')).catch(logger.error);
  let lastTimestamp = Math.floor(Date.now() / 1000);
  let Channel = null;
  if (bot.guilds.exists('id', process.env.DISCORD_SERVERID)) {
    const guild = bot.guilds.find('id', process.env.DISCORD_SERVERID);
    for (const channel of guild.channels.array()) {
      if (channel.name === process.env.DISCORD_CHANNEL) {
        Channel = channel;
      }
    }
  }

  if (!Channel) {
    logger.error('A matching channel could not be found. Please check your DISCORD_SERVERID and DISCORD_CHANNEL environment variables.');
    process.exit(1);
  } else {
    logger.info('Ready');
  }

  const subredditUrl = `https://www.reddit.com/r/${process.env.SUBREDDIT}/new.json?limit=10`;

  setInterval(() => {
    request({
      url: subredditUrl,
      json: true,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        logger.debug('Request succeeded, lastTimestamp = ', lastTimestamp);
        for (const post of body.data.children.reverse()) {
          if (lastTimestamp <= post.data.created_utc) {
            lastTimestamp = post.data.created_utc;
            let formattedPost = '';
            const postTitle = entities.decodeHTML(post.data.title);
            if (post.data.is_self) {
              formattedPost += `New text post in __/r/${process.env.SUBREDDIT}__\n\n`;
              formattedPost += `**${postTitle}**\n`;
              if (post.data.selftext.length > 0) {
                const postSelfText = entities.decodeHTML(post.data.selftext.length > 253 ? post.data.selftext.slice(0, 253).concat('...') : post.data.selftext);
                formattedPost += `\`\`\`${postSelfText}\`\`\`\n`;
              }
              formattedPost += `<https://redd.it/${post.data.id}>\n`;
            } else {
              formattedPost += `New link post in __/r/${process.env.SUBREDDIT}__\n\n`;
              formattedPost += `**${postTitle}**\n`;
              formattedPost += `<${post.data.url}>\n`;
              formattedPost += `<https://redd.it/${post.data.id}>\n`;
            }
            formattedPost += `_ _\n_ _`;
            Channel.sendMessage(formattedPost);
            logger.info(`Sent message for new post https://redd.it/${post.data.id}`);
          }
        }
        ++lastTimestamp; // so it's one above so it won't match them from previous queries
      } else {
        logger.warn('Request failed - reddit could be down or subreddit doesn\'t exist. Will continue.');
        logger.debug(response, body);
      }
    });
  }, 30000);
});

function onExit() {
  logger.info('Logging out before exiting');
  bot.destroy().then(error => {
    if (error) {
      logger.error('Unknown error during logout', error);
      process.exit(-1);
    } else {
      logger.info('Logout success');
      process.exit(0);
    }
  });
}

process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
