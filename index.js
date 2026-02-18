import ghpages from 'gh-pages';

ghpages.publish('dist',  {branch: 'gh-pages', repo: 'https://github.com/Mercyenary/sachin-portfolio.git'}, function (err){});