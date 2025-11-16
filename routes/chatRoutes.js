const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/create-or-get', chatController.getOrCreateChat);

// Send a message in a chat
router.post('/send-message',  chatController.sendMessage);

// Get messages for a specific chat
router.get('/:chatId/messages', chatController.getChatMessages);

// Mark messages as read
router.post('/mark-read', chatController.markMessagesRead);

// Get all chats for the logged-in user
router.get('/', chatController.getUserChats);

module.exports = router;