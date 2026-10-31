/* Christina — fixed catalogues: categories, thread colours, palettes, layout constants. */
const CATEGORIES = [
  { name: 'Study', hex: '4A90E2', icon: 'book' },
  { name: 'Work', hex: '7B68EE', icon: 'briefcase' },
  { name: 'Body', hex: 'FF6B9D', icon: 'activity' },
  { name: 'Social', hex: 'FFB347', icon: 'users' },
  { name: 'Personal', hex: '50C878', icon: 'user' },
  { name: 'Home', hex: 'D4AF37', icon: 'home' },
  { name: 'Enjoyed', hex: 'FF69B4', icon: 'heart' },
  { name: 'Other', hex: 'A9A9A9', icon: 'more' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));
const catOf = (name) => CAT[name] || CAT.Other;

const THREAD_COLORS = ['FF6B9D', '4A90E2', '7B68EE', 'FFB347', '50C878', 'D4AF37', 'FF69B4', '2EC4B6', 'E07A5F', 'A9A9A9'];

const PALETTES = [
  { name: 'Paper', colors: ['F2EDE4', 'D9CBB8', 'A68A64', '5E503F', '2B2118'] },
  { name: 'Dusk', colors: ['2E2A4F', '5B4B8A', 'A675A1', 'E8A0BF', 'F7D6E0'] },
  { name: 'Coast', colors: ['0B3954', '087E8B', 'BFD7EA', 'FF5A5F', 'C81D25'] },
  { name: 'Moss', colors: ['283618', '606C38', 'DDA15E', 'BC6C25', 'FEFAE0'] },
  { name: 'Citrus', colors: ['FFBE0B', 'FB5607', 'FF006E', '8338EC', '3A86FF'] },
  { name: 'Ink', colors: ['111111', '3D3D3D', '7A7A7A', 'BDBDBD', 'F0F0F0'] },
  { name: 'Bloom', colors: ['FF6B9D', 'FFB347', 'FFF3B0', '9ED8DB', '467599'] },
  { name: 'Winter', colors: ['E0FBFC', 'C2DFE3', '9DB4C0', '5C6B73', '253237'] },
];

const MAX_MONTH_IMAGES = 12;
const LANE_HEIGHT = 31; // label 15 + 2 + bar 10 + 4
export { CATEGORIES, CAT, catOf, THREAD_COLORS, PALETTES, MAX_MONTH_IMAGES, LANE_HEIGHT };
