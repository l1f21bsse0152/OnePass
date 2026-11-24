export const appBackground = require('../../assets/pictures/background.jpg');
export const onePassLogo = require('../../assets/pictures/onepass-logo.jpg');

const categoryImages = {
  gym: [
    require('../../assets/pictures/gym-1.jpg'),
    require('../../assets/pictures/gym-2.jpg'),
    require('../../assets/pictures/gym-3.jpg'),
    require('../../assets/pictures/gym-4.jpg'),
  ],
  library: [
    require('../../assets/pictures/library-1.jpg'),
    require('../../assets/pictures/library-2.jpg'),
    require('../../assets/pictures/library-3.jpg'),
    require('../../assets/pictures/library-4.jpg'),
  ],
  pool: [
    require('../../assets/pictures/pool-1.jpg'),
    require('../../assets/pictures/pool-2.jpg'),
    require('../../assets/pictures/pool-3.jpg'),
  ],
  workspace: [
    require('../../assets/pictures/workspace-1.jpg'),
    require('../../assets/pictures/workspace-2.jpg'),
    require('../../assets/pictures/workspace-3.jpg'),
    require('../../assets/pictures/workspace-4.jpg'),
  ],
};

export function categoryImage(category: string, name = '') {
  const value = category.toLowerCase();
  let images = categoryImages.workspace;

  if (value.includes('gym') || value.includes('fitness')) images = categoryImages.gym;
  else if (value.includes('library')) images = categoryImages.library;
  else if (value.includes('pool') || value.includes('swim')) images = categoryImages.pool;
  else if (value.includes('work')) images = categoryImages.workspace;

  const index =
    [...name].reduce((total, character) => total + character.charCodeAt(0), 0) %
    images.length;
  return images[index];
}
