const User = require('./User');
const Blog = require('./Blog');

Blog.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
User.hasMany(Blog, { foreignKey: 'author_id', as: 'blogs' });

module.exports = {
  User,
  Blog,
};
