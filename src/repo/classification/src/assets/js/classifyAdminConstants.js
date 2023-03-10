// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminConstants
 */
var exports = {};

//Object type
export let KEYLOV_DEFINITION_OBJECT_TYPE = '09';
export let CLASS_DEFINITION_OBJECT_TYPE = '01';

//Attributes MetaData Properties
export let CLASS_TYPE = 'ClassType';
export let APP_CLASS = 'Application Class';
export let ATTR_ATTRIBUTE_INDEX = 'AttributeIndex';
export let ATTR_DBINDEX = 'DBIndex';
export let ATTR_TYPE = 'Type';
export let ATTR_CARDINALITY = 'Cardinality';
export let ATTR_ANNOTATION = 'Annotation';
export let ATTR_IS_DEPRECATED = 'IsDeprecated';
export let ATTR_USERDATA = 'UserData';

export let COLUMN_NAME = 'Name';
export let CLASSES = 'Classes';
export let CLASS_NAME = 'Class Name';
export let KEYLOV = 'KeyLov';
export let NODES = 'Nodes';
export let PROPERTIES = 'Properties';

//Types
export let STRING_ARRAY = 'STRINGARRAY';

export let ECLASS = 'eclass';
export let TABLE = 'Table';

//KeyLOV Table constants
export let ASSOCIATED_CLASS = 'Associated Class';
export let ASSOCIATED_METRIC_KEYLOV = 'Associated Metric KeyLOV';
export let TABLE_COLUMN_KEY_STRING = 'StringValue';
export let TABLE_COLUMN_KEY_INTEGER = 'IntegerValue';
export let TABLE_COLUMN_KEY_DOUBLE = 'DoubleValue';
export let TABLE_COLUMN_KEY_BOOLEAN = 'Value';
export let TABLE_COLUMN_KEY_DATE = 'DateValue';

export let TABLE_COLUMN_VALUE = 'DisplayValue';
export let TABLE_COLUMN_VALUEMEANING = 'ValueMeaning';
export let TABLE_COLUMN_DEPENDENCYKEY = 'DependencyKey';
export let TABLE_COLUMN_BLOCKREFERENCE = 'BlockReference';
export let TABLE_COLUMN_PLAIN = 'Boolean Key';


//KeyLOV Schema Constants
export let JSON_RESPONSE_KEYLOV_STRING = 'LOVStringItems';
export let JSON_RESPONSE_KEYLOV_BOOLEAN = 'LOVBooleanItems';

//Logical strings
export let LOGICAL_FALSE = 'False';
export let LOGICAL_TRUE = 'True';

//ParentNode id value
export let TOP = 'top';

//JSON Request Constants
export let JSON_REQUEST_TYPE_PROP = 'PropertyDefinition';
export let JSON_REQUEST_TYPE_KEYLOV = 'KeyLOVDefinition';
export let JSON_REQUEST_TYPE_CLASS = 'ClassDefinition';
export let JSON_REQUEST_TYPE_NODE = 'NodeDefinition';
export let JSON_REQUEST_SCHEMA_VERSION = '1.0.0';
export let JSON_REQUEST_ENGLISH_LOCALE = 'en_US';

//JSON Response Constants
export let JSON_RESPONSE_PROPERTIES = 'Properties';
export let JSON_RESPONSE_LOV = 'LOV';
export let JSON_RESPONSE_ITEMS = 'Items';


//MetaData Properties : Common between classes, properties and KeyLOVs
export let NAMESPACE = 'Namespace';
export let IRDI = 'IRDI';
export let ID = 'ID';
export let MINOR_REVISION = 'MinorRevision';
export let STATUS = 'Status';
export let IS_DEPRECATED = 'IsDeprecated';
export let NAME = 'Name';
export let SORT_ASC = 'ASC';
export let HAS_CHILDREN = 'HasChildren';
export let SHORT_NAME = 'ShortName';
export let DEFINITION = 'Definition';
export let SOURCE_STANDARD = 'SourceStandard';
export let NOTE = 'Note';
export let REMARK = 'Remark';
export let OBJECT_TYPE = 'ObjectType';
export let REVISION = 'Revision';
export let IS_HIDE_KEYS = 'IsHideKeys';

//ClassType constants
export let IMMEDIATE_PARENT = 'Parents[0]';
export let PARENTS = 'Parents';
export let UNIT_SYSTEM = 'UnitSystem';
export let IS_ABSTRACT = 'IsAbstract';

export let CLASS_ATTRIBUTE = 'ClassAttributes';

//NodeType constants
export let HIERARCHICAL_POSITION = 'HierarchicalPosition';
export let NODE_PARENT = 'Parent';
export let NODE_APP_CLASS = 'ApplicationClass';
export let NODE_ID = 'NodeId';
export let NODE_PUID = 'puid';
export let NODE_ICONFILE_TICKET = 'IconFileTicket';
export let NODE_IMAGEFILE_TICKETS = 'ImageFileTickets';
export let NODE_APP_CLASS_TYPE = 'StorageClass';
export let NODE_CLASS_ID = '01-';
export let NODE_CLASS_ID_HASH = '#';

//Node: Application Class Constants
export let NODE_ATTR_PROPERTIES = 'Attribute Properties';
export let NODE_CLASS_PROPERTIES = 'Class Properties';
export let NODE_GRPNODE = 'This is a Group Node, so no Application Class is available.';
export let NODE_SMLRAC = 'For SML nodes, please perform Admin activity in Rich Client.';
export let NODE_APP_CLASS_SERVICENAME = 'Internal-IcsAw-2019-12-Classification';
export let NODE_APP_CLASS_OPERATION = 'findClassificationInfo3';
export let NODE_APP_CLASS_ATTRIBUTE_ID_SUBSTRING = 'cst0';
export let NODE_APP_CLASS_ATTRIBUTE_ID = 'IRDI';

//Class attribute constants
export let CLASS_ATTRIBUTE_TYPE = 'Type';
export let CLASS_ATTRIBUTE_TYPE_ASPECT = 'Aspect';
export let CLASS_ATTRIBUTE_TYPE_PROPERTY = 'Property';
export let CLASS_ATTRIBUTE_TYPE_BLOCK = 'Block';

//DataType constants
export let DATA_TYPE = 'DataType';
export let DATA_TYPE_STRING = 'String';
export let DATA_TYPE_INTEGER = 'Integer';
export let DATA_TYPE_DOUBLE = 'Double';
export let DATA_TYPE_DATE = 'Date';
export let DATA_TYPE_BOOLEAN = 'Boolean';
export let DATA_TYPE_REFERENCE = 'Reference';
export let DATA_TYPE_POSITION = 'Position';
export let DATA_TYPE_AXIS = 'Axis';
export let DATA_TYPE_VALUE_RANGE = 'Value_Range';
export let DATA_TYPE_VALUE_WITH_TOLERANCE = 'Value_With_Tolerance';
export let DATA_TYPE_LEVEL = 'Level';


export let DATA_TYPE_TYPE = 'Type';
export let DATA_TYPE_KEYLOV = 'KeyLOV'; //IsLocalizable
export let DATA_TYPE_IS_LOC = 'IsLocalizable';
export let DATA_TYPE_IS_LOC_TITLE = 'DataType.IsLocalizable';
export let DATA_TYPE_IS_POLY_CTR = 'IsPolymorphismController';
export let DATA_TYPE_IS_POLY_CTR_TITLE = 'DataType.IsPolymorphismController';
export let DATA_TYPE_KEYLOV_TITLE = 'DataType.KeyLOV';
export let DATA_TYPE_MAXLENGTH = 'MaxLength';
export let DATA_TYPE_NO_OF_DIGITS = 'NumberOfDigits';
export let DATA_TYPE_NON_METRIC_FORMAT = 'NonMetricFormat';
export let DATA_TYPE_METRIC_FORMAT = 'MetricFormat';
export let DATA_TYPE_PRECISION = 'Precision';
export let DATA_TYPE_SCALE = 'Scale';
export let DATA_TYPE_UNIT = 'Unit';
export let DEEPCONFIGLEVEL = 'DepConfigLevel';
export let DISPLAY_VALUE = 'DisplayValue';
export let KEYLOV_LOVITEMS = 'LOVItems';
export let KEYLOV_IS_SUBMENU = 'IsSubMenu';
export let KEYLOV_SUB_MENUITEMS = 'SubMenuItems';
export let KEYLOV_SUB_MENU_TITLE = 'SubMenuTitle';
export let USERDATA = 'UserData';
export let DATA_TYPE_BLOCKREFERENCE = 'BlockReference';
export let DATA_TYPE_CARDINALITYCONTROLLER = 'CardinalityController';
export let DATA_TYPE_CARDINALITYCONTROLLER_TITLE = 'DataType.CardinalityController';
export let DATA_TYPE_BLOCKREFERENCE_TITLE = 'DataType.BlockReference';
export let VALUE_KEY = 'Value';

export let SOA_NAME  = 'ClassificationCommon-2020-12-Classification';
export let OPERATION_NAME = 'searchClassificationDefinitions';


export let COLON = ':';

export let RELEASE = 'Release';
export let RELEASES = 'Releases';
//Tranlations
export let TRANSLATION_APPROVED = 'A';

export let ARR_METADATA_NODE_APP_CLASS_JSON = [
    NAME,
    IRDI,
    NAMESPACE,
    ID,
    REVISION,
    UNIT_SYSTEM
];

export let ARR_METADATA_NODE_PARENT = [
    NODE_ID,
    NAMESPACE,
    ID,
    REVISION
];


export let ARR_METADATA_NODE_APP_CLASS = [
    NAMESPACE,
    ID,
    REVISION
];


export let ARR_ATTRIBUTE_PROP = [
    ATTR_ATTRIBUTE_INDEX,
    ATTR_DBINDEX,
    ATTR_TYPE,
    ATTR_CARDINALITY,
    ATTR_ANNOTATION,
    ATTR_IS_DEPRECATED,
    ATTR_USERDATA
];


export let TABLE_KEYLOV_STRING = [
    TABLE_COLUMN_KEY_STRING,
    TABLE_COLUMN_VALUE,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_DEPENDENCYKEY
];

export let TABLE_KEYLOV_INTEGER = [
    TABLE_COLUMN_KEY_INTEGER,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_DEPENDENCYKEY
];

export let TABLE_KEYLOV_DOUBLE = [
    TABLE_COLUMN_KEY_DOUBLE,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_DEPENDENCYKEY
];


export let TABLE_KEYLOV_DATE = [
    TABLE_COLUMN_KEY_DATE,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_DEPENDENCYKEY
];


export let TABLE_KEYLOV_REFERENCE = [
    TABLE_COLUMN_KEY_STRING,
    TABLE_COLUMN_VALUE,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_BLOCKREFERENCE
];


export let TABLE_KEYLOV_BOOLEAN = [
    TABLE_COLUMN_KEY_BOOLEAN,
    TABLE_COLUMN_VALUE
];

export let ARR_METADATA_CLASS_NODE = [
    NODE_ID,
    NAMESPACE,
    ID,
    REVISION,
    MINOR_REVISION,
    IS_DEPRECATED,
    NAME,
    SHORT_NAME,
    DEFINITION,
    SOURCE_STANDARD,
    NOTE,
    REMARK,
    HIERARCHICAL_POSITION,
    USERDATA
];

export let ARR_METADATA_PROP = [
    NAME,
    IRDI,
    NAMESPACE,
    ID,
    REVISION,
    MINOR_REVISION,
    STATUS,
    IS_DEPRECATED,
    SHORT_NAME,
    DEFINITION,
    SOURCE_STANDARD,
    NOTE,
    REMARK,
    DEEPCONFIGLEVEL,
    USERDATA
];

export let ARR_METADATA_PROP_CLASS = [
    NAME,
    IRDI,
    NAMESPACE,
    ID,
    REVISION,
    DEFINITION,
    USERDATA
];


export let ARR_METADATA_KEYLOV_PROP = [
    IRDI,
    NAMESPACE,
    ID,
    REVISION,
    MINOR_REVISION,
    STATUS,
    IS_DEPRECATED,
    IS_HIDE_KEYS,
    NAME,
    SHORT_NAME,
    DEFINITION,
    SOURCE_STANDARD,
    NOTE,
    REMARK,
    DEEPCONFIGLEVEL,
    USERDATA
];

export let ARR_METADATA_CLASS_PROP = [
    NAME,
    IRDI,
    NAMESPACE,
    ID,
    REVISION,
    MINOR_REVISION,
    STATUS,
    SHORT_NAME,
    PARENTS,
    IS_ABSTRACT,
    UNIT_SYSTEM,
    CLASS_TYPE,
    DEFINITION,
    SOURCE_STANDARD,
    NOTE,
    REMARK,
    USERDATA
];

export let ARR_DATA_TYPE_STRING = [
    DATA_TYPE_MAXLENGTH,
    DATA_TYPE_IS_LOC,
    DATA_TYPE_UNIT,
    DATA_TYPE_KEYLOV,
    DATA_TYPE_IS_POLY_CTR
];

export let ARR_DATA_TYPE_REF = [
    DATA_TYPE_BLOCKREFERENCE,
    DATA_TYPE_CARDINALITYCONTROLLER
];


export let ARR_DATA_TYPE_BOOL = [
    DATA_TYPE_UNIT,
    DATA_TYPE_KEYLOV
];


export let ARR_DATA_TYPE_DOUBLE = [
    DATA_TYPE_PRECISION,
    DATA_TYPE_SCALE,
    DATA_TYPE_UNIT,
    DATA_TYPE_KEYLOV
];

export let ARR_DATA_TYPE_INTEGER = [
    DATA_TYPE_NO_OF_DIGITS,
    DATA_TYPE_UNIT,
    DATA_TYPE_KEYLOV
];

export let ARR_KEYLOV_RESPONSE_BOOL = [
    LOGICAL_FALSE,
    LOGICAL_TRUE
];

export default exports = {
    APP_CLASS,
    ARR_METADATA_CLASS_PROP,
    ARR_METADATA_NODE_PARENT,
    ARR_METADATA_NODE_APP_CLASS,
    ARR_ATTRIBUTE_PROP,
    ATTR_ATTRIBUTE_INDEX,
    ATTR_DBINDEX,
    ATTR_TYPE,
    ATTR_CARDINALITY,
    ATTR_ANNOTATION,
    ATTR_IS_DEPRECATED,
    ATTR_USERDATA,
    ARR_METADATA_PROP,
    ARR_METADATA_KEYLOV_PROP,
    ARR_METADATA_PROP_CLASS,
    ARR_METADATA_CLASS_NODE,
    ARR_METADATA_NODE_APP_CLASS_JSON,
    ARR_DATA_TYPE_STRING,
    ARR_DATA_TYPE_REF,
    ARR_DATA_TYPE_BOOL,
    ARR_DATA_TYPE_DOUBLE,
    ARR_DATA_TYPE_INTEGER,
    ARR_KEYLOV_RESPONSE_BOOL,
    ASSOCIATED_METRIC_KEYLOV,
    CLASS_TYPE,
    CLASS_ATTRIBUTE,
    CLASS_ATTRIBUTE_TYPE,
    CLASS_ATTRIBUTE_TYPE_ASPECT,
    CLASS_ATTRIBUTE_TYPE_PROPERTY,
    CLASS_ATTRIBUTE_TYPE_BLOCK,
    CLASS_NAME,
    CLASSES,
    CLASS_DEFINITION_OBJECT_TYPE,
    COLON,
    COLUMN_NAME,
    DATA_TYPE,
    DATA_TYPE_STRING,
    DATA_TYPE_INTEGER,
    DATA_TYPE_DOUBLE,
    DATA_TYPE_DATE,
    DATA_TYPE_BOOLEAN,
    DATA_TYPE_REFERENCE,
    DATA_TYPE_POSITION,
    DATA_TYPE_AXIS,
    DATA_TYPE_VALUE_RANGE,
    DATA_TYPE_VALUE_WITH_TOLERANCE,
    DATA_TYPE_LEVEL,
    DATA_TYPE_TYPE,
    DATA_TYPE_KEYLOV,
    DATA_TYPE_KEYLOV_TITLE,
    DATA_TYPE_IS_POLY_CTR,
    DATA_TYPE_IS_LOC,
    DATA_TYPE_IS_LOC_TITLE,
    DATA_TYPE_IS_POLY_CTR_TITLE,
    DATA_TYPE_MAXLENGTH,
    DATA_TYPE_NON_METRIC_FORMAT,
    DATA_TYPE_METRIC_FORMAT,
    DATA_TYPE_BLOCKREFERENCE,
    DATA_TYPE_BLOCKREFERENCE_TITLE,
    DATA_TYPE_CARDINALITYCONTROLLER,
    DATA_TYPE_CARDINALITYCONTROLLER_TITLE,
    DATA_TYPE_PRECISION,
    DATA_TYPE_SCALE,
    DATA_TYPE_UNIT,
    DATA_TYPE_NO_OF_DIGITS,
    DEFINITION,
    DEEPCONFIGLEVEL,
    DISPLAY_VALUE,
    ECLASS,
    HAS_CHILDREN,
    HIERARCHICAL_POSITION,
    ID,
    IMMEDIATE_PARENT,
    IS_DEPRECATED,
    IRDI,
    JSON_REQUEST_TYPE_CLASS,
    JSON_REQUEST_TYPE_KEYLOV,
    JSON_REQUEST_TYPE_NODE,
    JSON_REQUEST_TYPE_PROP,
    JSON_REQUEST_SCHEMA_VERSION,
    JSON_REQUEST_ENGLISH_LOCALE,
    JSON_RESPONSE_KEYLOV_STRING,
    JSON_RESPONSE_KEYLOV_BOOLEAN,
    JSON_RESPONSE_ITEMS,
    JSON_RESPONSE_LOV,
    JSON_RESPONSE_PROPERTIES,
    KEYLOV,
    KEYLOV_DEFINITION_OBJECT_TYPE,
    KEYLOV_LOVITEMS,
    KEYLOV_IS_SUBMENU,
    KEYLOV_SUB_MENUITEMS,
    KEYLOV_SUB_MENU_TITLE,
    LOGICAL_FALSE,
    LOGICAL_TRUE,
    MINOR_REVISION,
    IS_HIDE_KEYS,
    NAME,
    NAMESPACE,
    NODE_ICONFILE_TICKET,
    NODE_IMAGEFILE_TICKETS,
    NODE_ID,
    NODE_PUID,
    NODES,
    NOTE,
    NODE_PARENT,
    NODE_APP_CLASS,
    NODE_APP_CLASS_ATTRIBUTE_ID_SUBSTRING,
    NODE_APP_CLASS_ATTRIBUTE_ID,
    NODE_APP_CLASS_TYPE,
    NODE_APP_CLASS_SERVICENAME,
    NODE_APP_CLASS_OPERATION,
    NODE_CLASS_ID,
    NODE_CLASS_ID_HASH,
    OBJECT_TYPE,
    OPERATION_NAME,
    PARENTS,
    PROPERTIES,
    RELEASE,
    RELEASES,
    REMARK,
    REVISION,
    SOA_NAME,
    SORT_ASC,
    SHORT_NAME,
    SOURCE_STANDARD,
    STATUS,
    STRING_ARRAY,
    TABLE,
    TABLE_COLUMN_KEY_STRING,
    TABLE_COLUMN_KEY_INTEGER,
    TABLE_COLUMN_KEY_DOUBLE,
    TABLE_COLUMN_KEY_BOOLEAN,
    TABLE_COLUMN_KEY_DATE,
    TABLE_COLUMN_VALUE,
    TABLE_COLUMN_VALUEMEANING,
    TABLE_COLUMN_DEPENDENCYKEY,
    TABLE_COLUMN_BLOCKREFERENCE,
    TABLE_COLUMN_PLAIN,
    TABLE_KEYLOV_STRING,
    TABLE_KEYLOV_REFERENCE,
    TABLE_KEYLOV_BOOLEAN,
    TABLE_KEYLOV_INTEGER,
    TABLE_KEYLOV_DOUBLE,
    TABLE_KEYLOV_DATE,
    TOP,
    TRANSLATION_APPROVED,
    USERDATA,
    VALUE_KEY
};
