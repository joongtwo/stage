// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0Constants
 */
var exports = {};

export let FSC_CONTEXT = 'fscContext';
export let VCA_CONTEXT = 'variantConditionContext';

// REFER aliasRegistry to get actual name of svg for respective class
export let CFG_OBJECT_TYPES = {
    TYPE_REVISION: 'Cfg0AbsLiteralOptionValue',
    TYPE_PRODUCT_MODEL: 'Cfg0AbsProductModel',
    TYPE_LITERAL_FEATURE: 'Cfg0LiteralOptionValue',
    TYPE_UNCONFIGURE_OBJ: 'Cfg0UnconfiguredObject',
    TYPE_MODEL_FAMILY_GRP_REVISION: '__Fsc_Products_Group__',
    TYPE_FAMILY_GRP_REVISION: '__Fsc_Unassigned_Group__',
    TYPE_PROD_MODEL_REVISION: 'Cfg0ProductModel',
    TYPE_VARIANT_RULE: 'VariantRule',
    TYPE_MISSING: 'Cfg0MissingImg',
    TYPE_PRODUCT_ITEM: 'Cfg0ProductItem',
    TYPE_DICTIONARY: 'Cfg0Dictionary'
};

export let CFG_ICONS = {
    SVG_BLANK: 'cmdBlankIcon24.svg'
};

export let CONFIG_PERSPECTIVE_PROPS = {
    REVISION_RULE: 'cfg0RevisionRule'
};

export let CFG_INDICATOR_ICONS = {
    SVG_INDICATOR_DEFAULT_SELECTION: 'indicatorDefaultSelection16.svg',
    SVG_INDICATOR_SYSTEM_SELECTION: 'indicatorSystemSelection16.svg',
    SVG_INDICATOR_ERROR: 'indicatorError16.svg', // we dont keep indicator in aliasRegistry
    SVG_INDICATOR_NOT: 'indicatorExcluded16.svg', // NOT icon in Variability Trees
    SVG_INDICATOR_TICK: 'indicatorApprovedPass16.svg', // TICK icon in Variability Trees
    SVG_UNCONFIGURE_OBJ: 'typeUnconfiguredObject48.svg' // added to use icon name as it is
};

export let ENUMERATED_TYPES = [
    'Integer',
    'Floating Point',
    'Date'
];

export let EXPRESSION_TYPES = {
    USER_DEFINED_SELECTION : 48,
    VARIANT_CONDITION : 23,
    EXPANDED_EXPRESSION: 18,
    SUBJECT_EXPRESSION: 44,
    CONDITION_EXPRESSION: 25
};

export let FAMILY_VALUE_TYPES = [
    'Integer',
    'Floating Point',
    'Date',
    'String',
    'Boolean'
];

// Constant for psuedo groups uid
export let PSUEDO_GROUPS_UID = {
    PRODUCTS_GROUP_UID: '__Fsc_Products_Group__',
    UNASSIGNED_GROUP_UID: '__Fsc_Unassigned_Group__'
};

export let SEARCH_CRITERIA = {
    FEATURE: 'Feature',
    SELECTEDEXPRESSIONS: 'selectedExpressions'
};

export let IS_VARIANT_TREE_IN_EDIT_MODE = 'isVariantTableEditing';
export let SPLIT_COLUMN_DELIMITER = '#split#';
export let REQ_TYPE_INITIAL_VALIDATION = 'initialValidation';

export let GRID_DISPLAY_MODE = {
    CURRENT: 'current',
    FAMILIES: 'families',
    FEATURES: 'features'
};

export let VARIABILITY_BROWSING_GRID_VIEW = {
    MODELS: 'models',
    FEATURES: 'features',
    CONSTRAINTS: 'constraints',
    VARIANTS: 'variants'
};

export let GRID_EDIT_OPERATION = {
    START: 'start',
    CANCEL: 'cancel',
    SAVE_COMPLETE: 'saveComplete'
};

export let GRID_CONSTANTS = {
    SOURCE_TYPE: 'sourceType',
    TREE_CONTAINER_KEY: 'variabilityTreeData',
    VARIABILITY_CONTENT: 'variabilityContent',
    VARIANT_TREE_CONTEXT: 'VARIANT_TREE_CONTEXT',
    VARIANT_CONDITION: 'variantConditionAuthoringGrid',
    VARIANT_CONFIGURATION: 'variantConfigurationGrid'
};
export let VCA_VCV_GRID_HEIGHT_CONSTANTS = {
    DEFAULT_HEIGHT: 150,
    MAXIMUM_HEIGHT: 350
};

export let CFG_FAMILY_TYPES = [ 'Cfg0AbsModelFamily', 'Cfg0AbsOptionFamily' ];
export let CFG_FAMILY_FEATURES_TYPES = [ 'Cfg0AbsFamily', 'Cfg0AbsValue' ];

export default exports = {
    FSC_CONTEXT,
    VCA_CONTEXT,
    PSUEDO_GROUPS_UID,
    SEARCH_CRITERIA,
    IS_VARIANT_TREE_IN_EDIT_MODE,
    SPLIT_COLUMN_DELIMITER,
    REQ_TYPE_INITIAL_VALIDATION,
    GRID_DISPLAY_MODE,
    VARIABILITY_BROWSING_GRID_VIEW,
    GRID_EDIT_OPERATION,
    GRID_CONSTANTS,
    ENUMERATED_TYPES,
    FAMILY_VALUE_TYPES,
    CFG_OBJECT_TYPES,
    CFG_ICONS,
    CFG_INDICATOR_ICONS,
    CONFIG_PERSPECTIVE_PROPS,
    EXPRESSION_TYPES,
    CFG_FAMILY_TYPES,
    CFG_FAMILY_FEATURES_TYPES,
    VCA_VCV_GRID_HEIGHT_CONSTANTS
};
