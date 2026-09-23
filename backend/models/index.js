const User = require('./User');
const Blog = require('./Blog');
const ContactMessage = require('./ContactMessage');

Blog.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
User.hasMany(Blog, { foreignKey: 'author_id', as: 'blogs' });

ContactMessage.belongsTo(User, { foreignKey: 'handled_by', as: 'handler' });

module.exports = {
  User,
  Blog,
  ContactMessage,
};
