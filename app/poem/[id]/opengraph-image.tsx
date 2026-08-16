import PoemOpenGraphImage from './opengraph-image-handler';
import { POEM_PREVIEW_CARD_SIZE } from '../../../lib/poemCard/PoemCard';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = POEM_PREVIEW_CARD_SIZE;

export default PoemOpenGraphImage;
