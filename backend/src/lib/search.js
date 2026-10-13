export const SEARCH_TRANSLATE_FROM='áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ';
export const SEARCH_TRANSLATE_TO='aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

export function normalizeSearch(value,max=120){
  return String(value??'')
    .trim()
    .slice(0,max)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d')
    .replace(/Đ/g,'D')
    .toLowerCase();
}
