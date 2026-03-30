const express = require('express');
const postController = require('../controllers/postController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, postController.createPost);
router.get('/', auth, postController.getPosts);
router.get('/:id', auth, postController.getPost);
router.delete('/:id', auth, postController.deletePost);
router.post('/:id/publish', auth, postController.publishNow);

module.exports = router;
