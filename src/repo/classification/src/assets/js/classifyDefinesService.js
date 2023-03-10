// Copyright (c) 2022 Siemens

/**
 * This is a service file for release box component
 *
 * @module js/classifyDefinesService
 */
import localeService from 'js/localeService';
var exports = {};

//UNCT constants
export let UNCT_ICO_UID = 'ICO_ID';
export let UNCT_CLASS_ATTRIBUTE_NAME = 'ATTRIBUTE_NAME';

export let ICS_PFT = 'ICS_part_family_template';
export let LOAD_CLASS_CHILDREN_DEFAULT = 256;
export let LOAD_CLASS_CHILDREN_ASC = 64;
export let LOAD_CLASS_ROOTS = -600;
export let LOAD_CLASS_SUGGESTIONS = 1792;

// Classification object prefixes
export const CLASS_OBJ_PREFIX_SML0 = 'Sml0';
export const CLASS_OBJ_PREFIX_CST0 = 'Cst0';

// Setting editClassUID to 14 As. 14 As is a null UID to TeamCenter2
export const NULL_UID = 'AAAAAAAAAAAAAA';
export const ATTRIBUTE_ID_LABEL = 'Id';
export const UNKNOWN_TYPE = 'unknownType';

// findClassificationInfo3 Response Constants
export const CLASS_ID_PROPERTY = 'CLASS_ID';
export const CLS0_DEFAULT_VIEW = 'Cls0DefaultView';
export const CLASSIFICATION_SAM = 'SAM';
export const CLASSIFICATION_ICM = 'ICM';
export const NODE_UID_PROPERTY = 'NODE_UID';
export const LOCALIZATION_ACCESS_PROPERTY = 'LOCALIZATION_ACCESS';

// findClassificationInfo3 SOA request
export const CLASSIFICATION_SERVICENAME = 'Internal-IcsAw-2019-12-Classification';
export const CLASSIFICATION_OPERATIONNAME = 'findClassificationInfo3';

// Anchors
export const LOCALIZATION_ANCHOR = 'classifyAwMultiLanguageProperty';

// Logical Constants
export let LOGICAL_STR_FALSE = 'false';
export let LOGICAL_STR_TRUE = 'true';
export let PROPERTY_DISP_VAL = 'propDisplayValue';
export let ROOT_LEVEL_ID = 'top';

// Property Defines
export const CLS_PROPERTY_TYPE_BLOCK = 'Block';

// Property for External Tree Update
export var SHOW_CHILDREN = 'Show Children';
localeService.getLocalizedTextFromKey( 'treeTableMessages.TwistieTooltipCollapsed' ).then( function( result ) {
    SHOW_CHILDREN = result;
} );
export var HIDE_CHILDREN = 'Hide Children';
localeService.getLocalizedTextFromKey( 'treeTableMessages.TwistieTooltipExpanded' ).then( function( result ) {
    HIDE_CHILDREN = result;
} );

// Cls0Classification Error Codes
export const CLS_ERR_DUPLICATE_STANDALONE_OBJECT = 132614;
export const CLS_ERR_MULTIPLE_CLASSIFICATION_NOT_ALLOWED = 132606;

// ICS / SML Classification Error Codes
export const SML_ERR_ATTRIBUTE_ERR = 71201;
export const SML_ERR_FORMAT_INCORRECT_DATE = 71369;
export const SML_ERR_FORMAT_TOO_MANY_DIGITS_LEFT_TO_DECIMAL_POINT = 71356;
export const SML_ERR_INSTANCE_NOT_UNIQUE = 71045;
export const SML_ERR_MULTIINST_VIOLATION = 71067;
export const SML_ERR_NO_ACCESS = 71061;

export default exports = {
    ATTRIBUTE_ID_LABEL,
    CLASSIFICATION_ICM,
    CLASSIFICATION_SAM,
    CLASSIFICATION_SERVICENAME,
    CLASSIFICATION_OPERATIONNAME,
    CLASS_ID_PROPERTY,
    CLASS_OBJ_PREFIX_CST0,
    CLASS_OBJ_PREFIX_SML0,
    CLS0_DEFAULT_VIEW,
    CLS_ERR_DUPLICATE_STANDALONE_OBJECT,
    CLS_ERR_MULTIPLE_CLASSIFICATION_NOT_ALLOWED,
    CLS_PROPERTY_TYPE_BLOCK,
    HIDE_CHILDREN,
    ICS_PFT,
    LOAD_CLASS_CHILDREN_ASC,
    LOAD_CLASS_CHILDREN_DEFAULT,
    LOAD_CLASS_ROOTS,
    LOAD_CLASS_SUGGESTIONS,
    LOCALIZATION_ACCESS_PROPERTY,
    LOCALIZATION_ANCHOR,
    LOGICAL_STR_FALSE,
    LOGICAL_STR_TRUE,
    NODE_UID_PROPERTY,
    NULL_UID,
    PROPERTY_DISP_VAL,
    ROOT_LEVEL_ID,
    SHOW_CHILDREN,
    SML_ERR_ATTRIBUTE_ERR,
    SML_ERR_FORMAT_INCORRECT_DATE,
    SML_ERR_FORMAT_TOO_MANY_DIGITS_LEFT_TO_DECIMAL_POINT,
    SML_ERR_INSTANCE_NOT_UNIQUE,
    SML_ERR_MULTIINST_VIOLATION,
    SML_ERR_NO_ACCESS,
    UNCT_CLASS_ATTRIBUTE_NAME,
    UNCT_ICO_UID,
    UNKNOWN_TYPE
};
