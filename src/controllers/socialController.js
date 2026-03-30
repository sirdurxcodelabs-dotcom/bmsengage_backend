const SocialAccount = require('../models/SocialAccount');

exports.getConnectedAccounts = async (req, res) => {
  try {
    const accounts = await SocialAccount.find({ userId: req.userId, isActive: true })
      .select('-accessToken -refreshToken');

    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.disconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await SocialAccount.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { isActive: false }
    );

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
