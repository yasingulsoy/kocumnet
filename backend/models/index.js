const User = require('./User');
const Blog = require('./Blog');
const ContactMessage = require('./ContactMessage');
const StaffToken = require('./StaffToken');
const AuditLog = require('./AuditLog');
const ReplyTemplate = require('./ReplyTemplate');
const BlogRevision = require('./BlogRevision');

Blog.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
User.hasMany(Blog, { foreignKey: 'author_id', as: 'blogs' });

ContactMessage.belongsTo(User, { foreignKey: 'handled_by', as: 'handler' });
// Yanıtlayan hesap silinse de mesaj kalır: veritabanı kısıtı yok, ad boş görünür.
ContactMessage.belongsTo(User, { foreignKey: 'answered_by', as: 'answerer', constraints: false });

StaffToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(StaffToken, { foreignKey: 'user_id', as: 'tokens' });

// Sürümler yazıyla birlikte silinir; kaydeden hesap silinse de sürüm kalır.
Blog.hasMany(BlogRevision, { foreignKey: 'blog_id', as: 'revisions', onDelete: 'CASCADE' });
BlogRevision.belongsTo(Blog, { foreignKey: 'blog_id', as: 'blog' });
BlogRevision.belongsTo(User, { foreignKey: 'created_by', as: 'author', constraints: false });

// Denetim kaydı, kişi silinince de durur (actor_email anlık görüntü).
AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor', constraints: false });

module.exports = {
  User,
  Blog,
  ContactMessage,
  StaffToken,
  AuditLog,
  ReplyTemplate,
  BlogRevision,
};
