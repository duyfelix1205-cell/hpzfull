const DEFINITIONS={
  'journal-type':{
    route:'journal-type',
    scope:'JOURNAL_TYPE',
    defaultValue:'ANNOUNCEMENT',
    table:'catalog_journal_entry',
    column:'entry_type',
    label:'journal type'
  },
  'wiki-category':{
    route:'wiki-category',
    scope:'WIKI_CATEGORY',
    defaultValue:'Kiến thức chung',
    table:'catalog_wiki_article',
    column:'category',
    label:'wiki category'
  }
};

export function taxonomyDefinition(value){
  return DEFINITIONS[String(value||'').trim().toLowerCase()]||null;
}

export function requireTaxonomyDefinition(value){
  const definition=taxonomyDefinition(value);
  if(definition)return definition;
  const error=new Error('Unsupported content taxonomy');
  error.status=404;
  throw error;
}

export function taxonomyOptionValue(scope,label){
  const definition=requireTaxonomyDefinition(scope);
  const clean=String(label||'').trim().replace(/\s+/g,' ').slice(0,160);
  if(!clean)return'';
  if(definition.route==='journal-type'){
    return clean.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80);
  }
  return clean;
}

export const CONTENT_TAXONOMY_ROUTES=Object.freeze(Object.keys(DEFINITIONS));
