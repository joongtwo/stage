/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a service to functions common to both full view and panel
 *
 * @module js/classifyUtils
 */
import AwFilterService from 'js/awFilterService';
import appCtxSvc from 'js/appCtxService';
import dateTimeService from 'js/dateTimeService';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';

var exports = {};

export let typeEnumMap = [ 'STRING', 'INTEGER', 'DOUBLE', 'DATE', 'BOOLEAN' ];
export let clsDateFormats = [ 'yyyyMMddHHmmss', 'yyMMddHHmmss', 'ddMMyyyyHHmmss', 'ddMMyyHHmmss',
    'dd.MM.yyyy HH:mm:ss', 'dd.MM.yy HH:mm:ss', 'dd.MM.yyyy', 'dd.MM.yy', 'yyMMdd', 'yyyyMMdd', '',
    'MM/dd/yy HH:mm:ss', 'MM/dd/yy', 'dd-MMM-yyyy HH:mm', 'yyyy-MM-ddTHH:MM:SS-TH:TM'
];

export let DATE = 'DATE';
export let DATE_ARRAY = 'DATEARRAY';

export let loadClassChildren = 16; //(1 << 4)

// Global 'const' variables (Javascript doesn't support const keyword everywhere yet)
export let KL_HASH_STR = '#';
export let KL_SEPARATOR = '#-';
// When user clears the date manually, the date widget puts following epoch value by default.
export let CLEARED_WIDGET_DATE_CHROME = '-62135617980000';
export let CLEARED_WIDGET_DATE_IE = '-62135578800000';
export let CLEARED_WIDGET_DATE_FF = '-62135579038000';
export let FORMAT_WITH_MMM_DATE = 'dd-MMM-yyyy HH:mm';
export let CST_DATE_FORMAT_INDEX = 13;
export let CST_DEFAULT_DATE_FORMAT_INDEX = 14;
export let EMPTYSTRING = '';
export let ZEROSTRING = '0';
export let AXIS = 9;
export let ROTATION_MINIMUM_INDEX = 4;
var DATE_FORMAT_LENGTH = 14;
var _tcServerVersion = null;
export let COMPLEXVMOMINIMUMLENGTH = 3;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ClsUtilValueMap Handling and Functions

/**
 * Value map instance definition
 *
 * @param {Object} data - the viewmodel data for this panel
 * @param {String} classID - the class ID
 * @param {Object} properties - the root level properties of the given class
 * @param {Object} blockProperties - the block properties of the given class
 * @param {Object-Array} attributeArray - formatted attributes for the given class. Not used if properties OR blockProperties is supplied
 */
function ClsUtilValueMap( data, classID, properties, blockProperties, attributeArray ) {
    this.classID = classID;
    this.properties = null;
    this.blockProperties = null;
    if( properties || blockProperties ) {
        this.properties = properties;
        //Wrap the first level of blockDataMap in an object to assist with uniform recursion
        this.blockProperties = { blockDataMap: blockProperties };
    } else if( attributeArray ) {
        this.properties = this.getRootLevelPropertiesFromAttributes( attributeArray, data.unitSystem );
        this.blockProperties = this.getBlocksFromAttributes( attributeArray, data.unitSystem, data );
    }
}

/**
 * Value map instance definition for location
 * @param {Object} data - the viewmodel data for this panel
 * @param {String} classID - the class ID
 * @param {Object} properties - the root level properties of the given class
 * @param {Object} blockProperties - the block properties of the given class
 * @param {Object-Array} attributeArray - formatted attributes for the given class. Not used if properties OR blockProperties is supplied
 */
function ClsUtilValueMapForLocation( data, classID, properties, blockProperties, attributeArray ) {
    this.classID = classID;
    this.properties = null;
    this.blockProperties = null;
    if( properties || blockProperties ) {
        this.properties = properties;
        //Wrap the first level of blockDataMap in an object to assist with uniform recursion
        this.blockProperties = { blockDataMap: blockProperties };
    } else if( attributeArray ) {
        this.properties = this.getRootLevelPropertiesFromAttributes( attributeArray, data.unitSystem );
        this.blockProperties = this.getBlocksFromAttributes( attributeArray, data.unitSystem, data );
    }
}

/**


 * Gets the root level, of current scope, properties from the attribute array and returns them formatter for location
 * @deprecated could not find instance where this is used, will be removed later
 * @param {Object-Array} attributeArray - formatted attributes
 * @return {Object-Array} the formatted properties array
 */
ClsUtilValueMap.prototype.getRootLevelPropertiesFromAttributesForLocation = function( attributeArray ) {
    var rootLevelProperties = [];
    _.forEach( attributeArray, function( attribute ) {
        var values = [];
        //Skip Block and Separator types
        if( attribute.type !== 'Block' && attribute.type !== 'Separator' ) {
            var attributeVmo = attribute.vmps[ 0 ];
        }
    } );
};

/**
 * Gets the root level, of current scope, properties from the attribute array and returns them formatted
 *
 * @param {Object-Array} attributeArray - formatted attributes
 * @param {Object} unitSystem - the unit system object for the class
 * @return {Object-Array} the formatted properties array
 */
ClsUtilValueMap.prototype.getRootLevelPropertiesFromAttributes = function( attributeArray, unitSystem ) {
    var rootLevelProperties = [];
    _.forEach( attributeArray, ( attribute ) => {
        //Skip Block and Separator types
        if( attribute.type !== 'Block' && attribute.type !== 'Separator' ) {
            var values = [];
            var attributeVmo = attribute.vmps[ 0 ];
            // fix for unitsystem switch issue
            if ( attributeVmo.valueUpdated && !exports.isNullOrEmpty( attributeVmo.dbValue ) ) {
                if( exports.isNullOrEmpty( attributeVmo.displayValues ) ) {
                    // update displayValues with the dbValue, for saving purposes
                    attributeVmo.displayValues = [];
                    if( attributeVmo.displayValues.length > 0 ) {
                        attributeVmo.displayValues.push( attributeVmo.dbValue );
                    }else{
                        attributeVmo.displayValues = attributeVmo.dbValue;
                    }
                } else {
                    if ( _.isArray( attributeVmo.dbValue ) ) {
                        if( attributeVmo.dbValue.length > attributeVmo.displayValues.length ) {
                            attributeVmo.displayValues = attributeVmo.dbValue;
                        }
                    } else if ( attributeVmo.dbValues ) {
                        attributeVmo.dbValues = attributeVmo.displayValues;
                    }
                }
            }

            if ( attribute.vmps.length > COMPLEXVMOMINIMUMLENGTH ) { //Complex
                for ( var i = 0; i < attribute.vmps.length; i++ ) {
                    if ( i !== 1 && i !== 2 ) {
                        // Current VMO is not VMO index 1 or 2, 0 and => 3 are values.
                        // VMO 1 is label, VMO 2 is unit System
                        values.push( exports.addComplexValuesToOutPut( attribute, values, attribute.vmps[i], i ) );
                    }
                }
                var numEmpty = 0;
                for ( var i = 0; i < values.length; i++ ) {
                    if ( values[i].internalValue === ZEROSTRING && values[i].displayValue === ZEROSTRING ) {
                        numEmpty++;
                    }
                }
                if ( numEmpty === values.length ) {
                    for ( var i = 0; i < values.length; i++ ) {
                        values[i].internalValue = EMPTYSTRING;
                        values[i].displayValue = EMPTYSTRING;
                    }
                }
                rootLevelProperties = parseValues( values, attributeVmo, attribute, rootLevelProperties );
            } else if( !exports.isNullOrEmpty( attributeVmo.displayValues ) || attributeVmo.isArray && attributeVmo.valueUpdated ) {
                //If displayValues is not an array (this currently happens with defaultValues, make it one)
                if( !_.isArray( attributeVmo.displayValues ) ) {
                    attributeVmo.displayValues = [ attributeVmo.displayValues ];
                }
                // Loop over the values for this attribute
                // eslint-disable-next-line complexity
                attributeVmo.displayValues.forEach( ( item, valIdx ) => {
                    var propertyValueObj = {
                        internalValue: '',
                        displayValue: ''
                    };
                    var dbValue;
                    if( attributeVmo.dbValue ) {
                        dbValue = _.isArray( attributeVmo.dbValue ) && attributeVmo.dbValue.length > 0 ? attributeVmo.dbValue[ valIdx ]
                            .toString() : attributeVmo.dbValue.toString();
                    }

                    if( dbValue && attributeVmo.type === 'DATE' || attributeVmo.type === exports.DATE_ARRAY ) {
                        // When user clears up the date manually in DateWidget, the widget passes this value as -62135578800000
                        // We need to arrest this, and set it to empty.
                        if( dbValue === exports.CLEARED_WIDGET_DATE_CHROME ||
                            dbValue === exports.CLEARED_WIDGET_DATE_IE ||
                            dbValue === exports.CLEARED_WIDGET_DATE_FF ||
                            dbValue === '' ) {
                            propertyValueObj.displayValue = '';
                            propertyValueObj.internalValue = '';
                        } else if( dbValue && !isNaN( dbValue ) && dbValue !== '' ) {
                            var tempUnitSystem;
                            if( unitSystem && unitSystem.dbValue ) {
                                tempUnitSystem = unitSystem.dbValue;
                            } else {
                                if( attributeVmo.metricFormat ) {
                                    tempUnitSystem = attributeVmo.metricFormat;
                                } else if( attributeVmo.nonMetricFormat ) {
                                    tempUnitSystem = attributeVmo.nonMetricFormat;
                                }
                            }
                            var tempAttrId = attribute.id;
                            var tempAttrPrefix = attribute.prefix;
                            //Cst Dates can only be in one format, so use that format
                            var formatTypeIndex = tempAttrId.substring( 0, 4 ) === 'cst0' || tempAttrPrefix
                                .substring( 0, 4 ) === 'cst0' ? exports.CST_DATE_FORMAT_INDEX :
                                tempUnitSystem.formatDefinition.formatLength;

                            var clsDateFormat = exports.clsDateFormats[ formatTypeIndex ];
                            dbValue = AwFilterService.instance( 'date' )( dbValue, clsDateFormat );

                            if( dbValue !== '' ) {
                                propertyValueObj.displayValue = dbValue;
                                propertyValueObj.internalValue = dbValue;
                            }
                        } else {
                            propertyValueObj.displayValue = item;
                            propertyValueObj.internalValue = item;
                        }
                    } else if( attributeVmo.hasLov ) {
                        //We need dbValues for keylov's to correctly save the ICO attributes
                        propertyValueObj.displayValue = dbValue;
                        propertyValueObj.internalValue = dbValue;
                    } else {
                        if( attributeVmo && attributeVmo.displayValues && attributeVmo.displayValues[ valIdx ] ) {
                            // Send unit to platform to convert there, upon saving.
                            if( attribute.vmps && attribute.vmps[ 2 ] && ( attribute.vmps[ 2 ].names || attribute.vmps[ 2 ].propertyName ) ) {
                                var selectedUnitDef = 0;
                                var storageUnitDef = 0;
                                var delimiter = ' |~| ';
                                var displayValueString = '';
                                _.forEach( attribute.vmps[ 2 ].unitDefs, function( unit ) {
                                    if( unit.displayName === attribute.vmps[ 2 ].uiValue ) {
                                        selectedUnitDef = unit;
                                    }

                                    // we should always  use storage unit of attribute because uiOriginal Value can changes in case of edit when user select different
                                    //unit from unit drop down box and save.
                                    var storageUnitName = 0;
                                    if ( attribute && attribute.unitSystem && attribute.unitSystem.storageUnitSystemName !== undefined && attribute.unitSystem.storageUnitSystemName !== '' ) {
                                        storageUnitName = attribute.unitSystem.storageUnitSystemName;
                                    } else {
                                        //  when user is classifying first time, uiOriginalValue value is storage unit of the attribute.
                                        storageUnitName = attribute.vmps[2].uiOriginalValue;
                                    }

                                    if( unit.displayName === storageUnitName ) {
                                        storageUnitDef = unit;
                                    }
                                } );
                                var unitSystem = attribute.unitSystem.formatDefinition;
                                var unitSystemString = unitSystem.formatType.toString() + unitSystem.formatModifier1.toString() + unitSystem.formatModifier2.toString(); //+ unitSystem.formatLength.toString();
                                if( unitSystem.formatLength < 10 ) {
                                    var temp = '0' + unitSystem.formatLength.toString();
                                    unitSystemString += temp;
                                } else if( unitSystem.formatLength > 10 ) {
                                    unitSystemString += unitSystem.formatLength.toString();
                                }
                                //build displayValueString
                                displayValueString = unitSystemString + delimiter + storageUnitDef.unitID + delimiter + selectedUnitDef.unitID;

                                propertyValueObj.displayValue = displayValueString; //attribute.vmps[2].uiValue;
                                if ( attributeVmo.dbValues ) {
                                    propertyValueObj.internalValue = attributeVmo.dbValues[valIdx].toString();
                                } else {
                                    if ( Array.isArray( attributeVmo.dbValue ) ) {
                                        propertyValueObj.internalValue = attributeVmo.dbValue[valIdx].toString();
                                    } else if ( attributeVmo.dbValue ) {
                                        propertyValueObj.internalValue = attributeVmo.dbValue.toString();
                                    }
                                }
                            } else if ( attributeVmo.displayValues ) {
                                if ( attributeVmo.displayValues && attributeVmo.displayValues.length > 0 ) {
                                    propertyValueObj.displayValue = attributeVmo.displayValues[ valIdx ].toString();
                                    propertyValueObj.internalValue = attributeVmo.displayValues[ valIdx ].toString();
                                }
                            }
                        }
                    }
                    values.push( propertyValueObj );
                } );
                rootLevelProperties = parseValues( values, attributeVmo, attribute, rootLevelProperties );
            } else if( attribute.daterange !== undefined ) {
                this.handleDateRange( attribute, values, rootLevelProperties );
            } else if( attribute.numericRange !== undefined ) {
                this.handleNumericRange( attribute, values, rootLevelProperties );
            }
        }
    } );

    return rootLevelProperties;
};
/**
 *
 * @param {Object} values - the values
 */
function parseValues( values, attributeVmo, attribute, rootLevelProperties ) {
    // Adding empty object to the list so that saveClassificationObjects SOA will remove any values for this property
    if( typeof values !== 'undefined' && values.length < 1 ) {
        values.push( {
            internalValue: '',
            displayValue: ''
        } );
    }

    // Check if the values contains empty values, complex properties will overwrite the flag to enable saving unused fields.
    var hasEmptyVals = exports.hasEmptyValues( values );
    if ( hasEmptyVals && attribute.vmps.length > COMPLEXVMOMINIMUMLENGTH ) {
        var skip = false;
        for ( var i = 0; i < values.length; i++ ) {
            if ( values[i].internalValue === '' ) {
                skip = true;
                hasEmptyVals = false;
                break; // Skip the remaining check, its not needed if hasEmptyValues is false.
            }
        }
    }
    if( !hasEmptyVals || hasEmptyVals && attributeVmo.valueUpdated ) {
        rootLevelProperties.push( {
            propertyId: attribute.id,
            propertyName: attribute.name,
            values: values
        } );
    }
    return rootLevelProperties;
}


ClsUtilValueMap.prototype.handleDateRange = function( attribute, values, rootLevelProperties ) {
    // this is for location
    // Get the start and end values of the range
    var startValue;
    var endValue;
    //Mon Jan 01 0001 00:00:28 GMT+0553 (India Standard Time)
    //attribute.daterange.startDate && attribute.daterange.endDate
    if( !dateTimeService.isNullDate( attribute.daterange.startDate.dateApi.dateObject ) ) {
        startValue = attribute.daterange.startDate.dateApi.dateObject.toString();
    }

    if( !dateTimeService.isNullDate( attribute.daterange.endDate.dateApi.dateObject ) ) {
        endValue = attribute.daterange.endDate.dateApi.dateObject.toString();
    }
    // Use filter panel utils to get the date range filter and create searchFilterMap
    //var internalName = filterPanelUtils_.getDateRangeString(startValue, endValue);

    if( attribute.daterange.startDate.valueUpdated === true || attribute.daterange.endDate.valueUpdated === true ) {
        values.push( {
            startDate: startValue,
            endDate: endValue
        } );

        rootLevelProperties.push( {
            propertyId: attribute.id,
            propertyName: attribute.name,
            values: values
        } );
    }
};
ClsUtilValueMap.prototype.handleNumericRange = function( attribute, values, rootLevelProperties ) {
    var startRange;
    var endRange;

    if( attribute.numericRange.startValue ) {
        if( !isNaN( attribute.numericRange.startValue.dbValue ) ) {
            startRange = parseFloat( attribute.numericRange.startValue.dbValue );
        } else {
            startRange = undefined;
        }
    }

    if( attribute.numericRange.endValue ) {
        if( !isNaN( attribute.numericRange.endValue.dbValue ) ) {
            endRange = parseFloat( attribute.numericRange.endValue.dbValue );
        } else {
            endRange = undefined;
        }
    }

    if( !isNaN( startRange ) || !isNaN( endRange ) ) {
        values.push( {
            startRange: startRange,
            endRange: endRange
        } );

        rootLevelProperties.push( {
            propertyId: attribute.id,
            propertyName: attribute.name,
            values: values
        } );
    }
};

/**
 * Creates a block data map for saving classification information
 *
 * @param {Object-Array} attributeArray - the array of attributes to get the blocks out of
 * @param {Object-Array} unitSystem - the unitsystem for the class
 * @param {Object} data - the viewmodel data for this panel
 * @returns {Object} the block data map object
 */
ClsUtilValueMap.prototype.getBlocksFromAttributes = function( attributeArray, unitSystem, data ) {
    var blockProperties = {};
    for( var attrInx in attributeArray ) {
        var attribute = attributeArray[ attrInx ];
        if( attribute.type === 'Block' ) {
            var attrID = attribute.id;
            //trim cst0 from front if it exists
            if( attrID.substring( 0, 4 ) === 'cst0' ) {
                attrID = attrID.substring( 4, attrID.length );
            }

            //Check if block is cardinal
            if( attribute.cardinalController ) {
                for( var instanceInx in attribute.instances ) {
                    var instance = attribute.instances[ instanceInx ];
                    //get values from table if appropriate
                    if( attribute.tableView && data.searchResults ) {
                        exports.getAttributeValuesFromTable( data, instance );
                    }
                    var instanceObject = {
                        classId: instance.blockId,
                        //Get the last element in array, as it is the index at this position
                        cardinalityIndex: instance.cardIndex[ instance.cardIndex.length - 1 ],
                        properties: this.getRootLevelPropertiesFromAttributes( instance.children, unitSystem ),
                        blockDataMap: this.getBlocksFromAttributes( instance.children, unitSystem, data )
                    };
                    /* LCS-161331 - This block will need to be re-enabled in AW4.2 once server/platform/AOM side issue has been fixed */
                    //if( !_.isEmpty( instanceObject.properties ) || !_.isEmpty( instanceObject.blockDataMap ) || instance.polymorphicTypeProperty ) {
                    //If entry does not exist, create new empty
                    if( !blockProperties.hasOwnProperty( attrID ) ) {
                        blockProperties[ attrID ] = {
                            blocks: []
                        };
                    }
                    blockProperties[ attrID ].blocks.push( instanceObject );
                    //}
                }
            } else {
                var blockObject = {
                    classId: attribute.blockId,
                    //Get the last element in array, as it is the index at this position
                    cardinalityIndex: attribute.cardIndex[ attribute.cardIndex.length - 1 ],
                    properties: this.getRootLevelPropertiesFromAttributes( attribute.children, unitSystem ),
                    blockDataMap: this.getBlocksFromAttributes( attribute.children, unitSystem, data )
                };
                if( !_.isEmpty( blockObject.properties ) || !_.isEmpty( blockObject.blockDataMap ) || attribute.polymorphicTypeProperty ) {
                    //If entry does not exist, create new empty
                    if( !blockProperties.hasOwnProperty( attrID ) ) {
                        blockProperties[ attrID ] = {
                            blocks: []
                        };
                    }
                    blockProperties[ attrID ].blocks.push( blockObject );
                }
            }
        }
    }

    return blockProperties;
};

/**
 * Takes a dot seperated attribute id string, and breaks it into segments upon the dot
 *
 * @param {Array} idChunks - the container output array for the individual attribute id segments
 * @param {String} attributeId - the attribute id to segment
 */
ClsUtilValueMap.prototype.getStringChunkArray = function( idChunks, attributeId ) {
    if( attributeId.indexOf( '.' ) > -1 ) {
        var nextIndex = attributeId.indexOf( '.' );
        var tempString = attributeId.substring( 0, nextIndex );
        idChunks.push( tempString );
        this.getStringChunkArray( idChunks, attributeId.substring( nextIndex + 1, attributeId.length ) );
    } else {
        idChunks.push( attributeId );
    }
};

/**
 * Retrieves the formatted attribute values for a given segmented attribute id from the given block Data Map
 *
 * @param {Array} idChunks - the container input array of attribute id segments
 * @param {Object} blockPropMap - the input block data map to pull the values from
 * @param {Integer} depth - the depth within the object structure currently being searched, used for recursion. Default starting value is 1
 * @param {Integer} indexs - the index array of the block and it's parents to get values from in the blockPropMap, used for cardinality
 * @returns {Object} the values pulled from the blockPropMap
 */
ClsUtilValueMap.prototype.getBlockAttributeValues = function( idChunks, blockPropMap, depth, indexs ) {
    var values = null;
    var tempId = idChunks[ depth - 1 ];
    if( tempId.substring( 0, 4 ) === 'cst0' ) {
        tempId = tempId.substring( 4, tempId.length );
    }
    //remove instance number added while adding instances.
    var index = tempId.lastIndexOf( '*' );
    if ( index !== -1 ) {
        tempId = tempId.substring( 0, index );
    }

    if( _.has( blockPropMap.blockDataMap, tempId ) ) {
        var indexValue = 1;
        if( indexs && Array.isArray( indexs ) ) {
            indexValue = indexs[ depth - 1 ];
        }
        var blockData = null;
        _.forEach( blockPropMap.blockDataMap[ tempId ].blocks, function( block ) {
            if( block.cardinalityIndex === indexValue ) {
                blockData = block;
            }
        } );
        depth++;
        if( blockData ) {
            if( depth !== idChunks.length ) {
                values = this.getBlockAttributeValues( idChunks, blockData, depth, indexs );
            } else {
                values = exports.getAttributeValues( idChunks[ depth - 1 ], blockData.properties );
            }
        }
    }
    return values;
};

/**
 * Retrieves the classId values for the given ID segments
 *
 * @param {Array} idChunks - the container input array of attribute id segments
 * @param {Object} blockPropMap - the input block data map to pull the value from
 * @param {Integer} depth - the depth within the object structure currently being searched, used for recursion. Default starting value is 1
 * @param {Integer} indexs - the index array of the block and it's parents to get values from in the blockPropMap, used for cardinality
 * @returns {Object} the classId value
 */
ClsUtilValueMap.prototype.getBlockId = function( idChunks, blockPropMap, depth, indexs ) {
    var blockId = null;
    var tempId = idChunks[ depth - 1 ];
    if( tempId.substring( 0, 4 ) === 'cst0' ) {
        tempId = tempId.substring( 4, tempId.length );
    }
    //remove instance number added while adding instances.
    var index = tempId.lastIndexOf( '*' );
    if ( index !== -1 ) {
        tempId = tempId.substring( 0, index );
    }
    // Get zeroth element for now, cardinality may need to use cardIndex and check it against each element to get correct block instance
    if( _.has( blockPropMap.blockDataMap, tempId ) ) {
        var indexValue = 1;
        if( indexs && Array.isArray( indexs ) ) {
            indexValue = indexs[ depth - 1 ];
        }
        var blockData = null;
        _.forEach( blockPropMap.blockDataMap[ tempId ].blocks, function( block ) {
            if( block.cardinalityIndex === indexValue ) {
                blockData = block;
            }
        } );
        if( blockData ) {
            if( depth !== idChunks.length ) {
                depth++;
                blockId = this.getBlockId( idChunks, blockData, depth, indexs );
            } else {
                blockId = blockData.classId;
            }
        }
    }
    return blockId;
};

/**
 * Retrieves the formatted attribute values from the values map object that owns this function
 *
 * @param {Array} attributeId - the attribute to gets the values for. If getting block values, prefix should be appended to the front
 * @param {Object} unitSystem - the unitsystem for the attribute
 * @param {Integer-Array} indexs - the index map for the block to get values from
 * @returns {Object} the formatted values
 */
ClsUtilValueMap.prototype.getFormattedPropertyValue = function( attributeId, unitSystem, indexs ) {
    var formattedValues = null;
    var idChunks = [];
    this.getStringChunkArray( idChunks, attributeId );
    if( idChunks.length > 1 ) {
        var blockAttributesValues = this.getBlockAttributeValues( idChunks, this.blockProperties, 1, indexs );
        formattedValues = exports.formatAttributeValue( blockAttributesValues, unitSystem );
    } else if( idChunks.length === 1 ) {
        var attributeValues = exports.getAttributeValues( idChunks[ 0 ], this.properties );
        formattedValues = exports.formatAttributeValue( attributeValues, unitSystem );
    }
    return formattedValues;
};

/**
 * Gets the Block ID (classId) for the given blockAttribute, used for load
 *
 * @param {Array} blockAttribute - the block attribute to get the polymorphic type of
 * @returns {Object} the formatted values
 */
ClsUtilValueMap.prototype.getPolymorphicType = function( blockAttribute ) {
    var blockId = null;
    var attrId = blockAttribute.prefix + blockAttribute.id;
    var idChunks = [];
    this.getStringChunkArray( idChunks, attrId );

    blockId = this.getBlockId( idChunks, this.blockProperties, 1, blockAttribute.cardIndex );

    return blockId;
};

/**
 * Sets values from table view onto attributes
 *
 * @param data - view model data
 * @param attribute - attribute
 * @param instance - instance
 */
export let getAttributeValuesFromTable = function( data, instance ) {
    _.forEach( instance.children, function( child ) {
        var index = _.findIndex( data.searchResults, function( prop ) {
            return child.id === prop.uid;
        } );
        if( index !== -1 ) {
            var vmProp = data.searchResults[ index ];
            if( vmProp.props[ instance.name ].dbValue ) {
                child.vmps[ 0 ].dbValue = vmProp.props[ instance.name ].dbValue;
            }
            child.vmps[ 0 ].displayValues = vmProp.props[ instance.name ].displayValues;
            child.vmps[ 0 ].uiValue = vmProp.props[ instance.name ].uiValue;
        }
    } );
};

/**
 * Creates a new value map instance from the given information
 *
 * @param {Object} data - the viewmodel data for this panel
 * @param {String} classID - the class ID
 * @param {Object} properties - the root level properties of the given class
 * @param {Object} blockProperties - the block properties of the given class
 * @param {Object-Array} attributeArray - formatted attributes for the given class. Not used if properties OR blockProperties is supplied
 * @returns {Object} the ClsUtilValueMap object
 */
export let getClsUtilValueMap = function( data, classID, properties, blockProperties, attributeArray ) {
    var objectOrNull = null;
    //At least one of these arguments must not be null
    if( properties || blockProperties || attributeArray ) {
        objectOrNull = new ClsUtilValueMap( data, classID, properties, blockProperties, attributeArray );
    }
    return objectOrNull;
};

// End ClsUtilValueMap Handling and Functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Retrieves all values from a property structure where the attributeId is equal to property id
 *
 * @param {String} attributeId - the attribute ID
 * @param {Object-Array} propertiesVect - the properties vector to check get the attribute values from
 * @returns {Array} the array of values
 */
export let getAttributeValues = function( attributeId, propertiesVect ) {
    var tempArray = null;
    _.forEach( propertiesVect, function( property ) {
        if( property.propertyId === attributeId ) {
            tempArray = property.values;
        }
    } );
    return tempArray;
};

/**
 * Converts a singular string value into a properly formatted value of the type specified by unit system
 *
 * @param {String} valueToConvert - the string value to convert
 * @param {Object} unitSystem - the unit system object used for formatting
 * @param {Boolean} numberToString - should a real or integer value be converted back to string, if true then it will be
 * @returns {Variable} the converted value
 */
export let convertValue = function( valueToConvert, unitSystem, numberToString ) {
    var convertedValue = null;
    var formatType = unitSystem.formatDefinition.formatType;
    switch ( formatType ) {
        case -1:
        case 0:
        case 3:
            // String, Date and LOV formatting
            convertedValue = valueToConvert;
            break;
        case 1:
        case 2:
            // Integer && Real
            convertedValue = valueToConvert !== '' ? numberToString ? Number( valueToConvert ).toString() : Number( valueToConvert ) : '';
            break;
        case 4:
            // Boolean
            var tempValue = valueToConvert !== '' ? valueToConvert.toLowerCase() === 'true' || valueToConvert === '1' : '';
            convertedValue = tempValue;
            break;
        case 5:
            break;
        case 6:
            break;
        case 7:
            break;
        case 8:
            break;
        case 9:
            break;
        default:
            throw 'Invalid attribute type: ' +
                unitSystem.formatDefinition.formatType;
    }
    return convertedValue;
};
/**
 * Formats the given array of values based on format type
 *
 * @param {Array} values - the array of values to format
 * @param {Object} unitSystem - the unit system object used for formatting
 * @returns {Array} the array of formatted values
 */
export let formatAttributeValue = function( values, unitSystem ) {
    var formattedValues = null;
    if( values && values.length > 0 ) {
        formattedValues = [];
        _.forEach( values, function( value1 ) {
            // Server sends the correct display value when diplay optimize flag is set for numeric attribute.
            // using display value to get the correct display value and unit name
            var formatType = unitSystem.formatDefinition.formatType;
            if( formatType === 1 || formatType === 2 ) {
                var  displayValueAndUnitName = exports.getSeparatedDispValAndUnitNameForNumericAttr( value1.displayValue, unitSystem );

                // class storage unit system needs to be stored  and should not change when user select different unit from drop down box
                if( unitSystem && unitSystem.unitName !== undefined && unitSystem.unitName !== '' ) {
                    var storageUnitSystemName = unitSystem.unitName;
                    unitSystem.storageUnitSystemName = storageUnitSystemName;
                }

                unitSystem.unitName = displayValueAndUnitName.unitName;
                formattedValues.push( exports.convertValue( displayValueAndUnitName.displayValue, unitSystem, true ) );
            } else {
                formattedValues.push( exports.convertValue( value1.internalValue, unitSystem, true ) );
            }
        } );
    }
    /*
    Since default value is to be shown only in preview and then Assign mode, do not pick up default value anywhere else.
    else if( unitSystem.defaultValue && unitSystem.defaultValue.length > 0 ) {
    } */

    return formattedValues;
};


/*
 * Get  the display value and Unit name for numberic(integer, real) attribute
 *
 * @param {Object} displayValueAndUnit - the combined display value and unit name
 * @param {Object} unitSystem - the unit system object used for formatting
 * @returns display value and unit name
 */
export let getSeparatedDispValAndUnitNameForNumericAttr = function( displayValueAndUnit, unitSystem ) {
    var  displayValueAndUnitName = {
        displayValue: displayValueAndUnit,
        unitName: ''
    };
    if( unitSystem && unitSystem.unitName !== undefined && unitSystem.unitName !== '' ) {
        var dispValueAndUnitName = displayValueAndUnit.split( ' ' );
        if( dispValueAndUnitName[1] === undefined ) {
            dispValueAndUnitName[1] = unitSystem.unitName;
        }

        displayValueAndUnitName.displayValue = dispValueAndUnitName[0];
        displayValueAndUnitName.unitName = dispValueAndUnitName[1];
    }
    return displayValueAndUnitName;
};

/*
 * Gets the unitSystem string for the classify operation
 *
 * @param {Object} data - the viewmodel data for this panel
 * @returns unit system
 */
export let getUnitSystem = function( data ) {
    return data.unitSystem.dbValue ? 'METRIC' : 'ENGLISH';
};

/**
 * @param {Object} response response from the getParents SOA
 *
 * @returns {StringArray} The array of required parentIds
 */
export let getParentIds = function( response ) {
    var parentIds = [];
    var parents = response.parents[ Object.keys( response.parents )[ 0 ] ];
    for( var parent in parents ) {
        if( typeof parent !== 'undefined' ) {
            var parentId = parents[ parent ];
            if( parentId === 'ICM' || parentId === 'SAM' ) {
                continue;
            }
            parentIds.unshift( parentId );
        }
    }
    parentIds.push( Object.keys( response.parents )[ 0 ] );
    return parentIds;
};

/**
 * Special case, method to check version of Team-center release,
 * The minimum supported versions are - 12.1*/
export let checkIfSupportedTcVersionForSort = function( majorVersion, minorVersion, qrmNumber ) {
    var supportedRelease = false;

    //Check for TC12.1 and beyond
    if(  majorVersion > 12  ||  majorVersion === 12 && minorVersion >= 1  ) {
        supportedRelease = true;
    }

    return supportedRelease;
};

/**
 * Method to check version of Team-center release. The minimum supported versions are - 10.1.7 and 11.2.3, for
 * other releases we are disabling the modes. However, if we classify the item revision in RAC, the
 * classification information should be visible. for e.g. Team-center server version is 10.1.7
 *
 * @param {String} majorVersion The major TC version (e.g. 10 in 10.1.7)
 * @param {String} minorVersion The minor TC version (e.g. 1 in 10.1.7)
 * @param {String}qrmNumber The qrmNumber for TC version (e.g. 7 in 10.1.7)
 * @return {Boolean} True if minimum supported version is 10.1.7 or 11.2.3
 *
 */
export let checkIfSupportedTcVersion = function( majorVersion, minorVersion, qrmNumber ) {
    var supportedRelease = false;
    if( majorVersion === 10 ) {
        if( minorVersion === 1 ) {
            if( qrmNumber >= 7 ) {
                supportedRelease = true;
            }
        }
    } else if( majorVersion === 11 ) {
        if( minorVersion === 2 ) {
            if( qrmNumber >= 3 ) {
                supportedRelease = true;
            } else {
                supportedRelease = false;
            }
        } else if( minorVersion > 2 && qrmNumber >= 0 ) {
            supportedRelease = true;
        }
    } else if( majorVersion > 11 ) {
        supportedRelease = true;
    } else {
        supportedRelease = false;
    }
    return supportedRelease;
};

export let getConcatenatedValues = function( propValues ) {
    var values = [];
    _.forEach( propValues, function( value ) {
        values.push( value.displayValue );
    } );

    var displayString = values.join( '}{' );

    if( values.length > 1 ) {
        displayString = '{' + displayString + '}';
    }

    return displayString;
};

/**
 * Helper method For an year specified in YY format, get the YYYY formatted value.
 *
 * @param {String} yearInYY - The year in YY format. e.g. "17"
 * @return {String} The year in YYYY format. e.g. "2017"
 */
export let getYearNumber = function( yearInYY ) {
    var yearInYYYY = yearInYY;

    // Some Y2K considerations here. This method needs to be removed once the new SOA is in place.
    // If the year value is >= 70 and <= 99, the year will be considered off 20th century (e.g. 1979 )
    // If the year value is >= 00 and <= 69, the year will be considered off 21st century ( e.g. 2017 )
    var yearInYYInt = parseInt( yearInYYYY );
    if( !isNaN( yearInYYInt ) ) {
        if( yearInYYInt >= 70 && yearInYYInt <= 99 ) {
            yearInYYYY = '19' + yearInYYInt;
        } else if( yearInYYInt >= 0 && yearInYYInt <= 9 ) {
            // The parseInt returns a single digit integer for this condition, hence -
            yearInYYYY = '200' + yearInYYInt;
        } else if( yearInYYInt >= 10 && yearInYYInt <= 69 ) {
            yearInYYYY = '20' + yearInYYInt;
        }
    } else {
        console.error( 'Invalid year specified!' );
    }

    return yearInYYYY;
};

/**
 * Helper method For a month specified in MMM format, returns the Month in 'MM' format.
 *
 * @param {String} monthInMMM - The month in MMM format. e.g. "AUG"
 * @return {String} The month in MM format. e.g. "08"
 */
export let getMonthNumber = function( monthInMMM ) {
    var monthNumber = '';
    if( monthInMMM !== '' ) {
        monthInMMM = monthInMMM.toUpperCase();
        monthNumber = [ 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC' ]
            .indexOf( monthInMMM );
        if( monthNumber !== -1 ) {
            monthNumber += 1;
            monthNumber = monthNumber < 10 ? '0' + monthNumber : monthNumber;
        } else {
            monthNumber = '';
        }
    }
    return monthNumber;
};

/**
 * Helper method. This method gets the timezone offset value in hours and minutes. The getTimezoneOffset returns
 * the offset in minutes, this method takes care of converting it in (+/-)HH:MM format e.g. "-04:00" or,
 * "+02:30" etc.
 *
 * @param {Object} dateStr - The date for which the timezone needs to be found.
 * @return {String} the offset value in in (+/-)HH:MM format.
 */
export let getTimezoneOffsetInHours = function( dateStr ) {
    var timeZoneOffsetInHours = '';
    var date = new Date( dateStr );
    if( !isNaN( date ) ) {
        var sign = date.getTimezoneOffset() > 0 ? '-' : '+';
        var offset = Math.abs( date.getTimezoneOffset() );

        var _pad = function( number ) {
            if( number < 10 ) {
                return '0' + number;
            }
            return number;
        };

        var hours = _pad( Math.floor( offset / 60 ) );
        var mins = _pad( offset % 60 );
        timeZoneOffsetInHours = sign + hours + ':' + mins;
    }
    return timeZoneOffsetInHours;
};

/**
 * Wrapper method to get all the values in date array converted in 'AW date Widget acceptable' format. This
 * method calls convertClsDateToAWDateWidgetFormat.
 *
 * @param {Array} serverDateValueArray - The date array containing dates in one of the Classification accepted
 *            date formats (See clsDateFormats)
 * @param {String} formatTypeIndex - the date type indicating from clsDateFormats which format the date will be.
 * @param {Boolean} isCstAttr - indicator of whether the attribute that owns the value is a Cst attribute or not
 * @return {Array} The date array containing date strings in format acceptable to the AW Date widget.
 */
export let convertClsDateArrayToAWDateWidgetFormat = function( serverDateValueArray, formatTypeIndex, isCstAttr ) {
    //If the attribute is from CST, we only use one format for the Date that comes back from server
    if( isCstAttr ) {
        formatTypeIndex = exports.CST_DATE_FORMAT_INDEX;
    }
    var awDateWidgetFormattedDates = [];
    if( serverDateValueArray && serverDateValueArray[ 0 ] ) {
        var awDateWidgetFormattedDate = {};
        _.forEach( serverDateValueArray, function( serverDateValue ) {
            awDateWidgetFormattedDate = exports.convertClsDateToAWDateWidgetFormat( serverDateValue,
                formatTypeIndex, isCstAttr );
            // if ( formatTypeIndex > 0 ) {
            //     awDateWidgetFormattedDate.displayValue = serverDateValue;
            // }

            awDateWidgetFormattedDates.push( awDateWidgetFormattedDate );
        } );
    }
    return awDateWidgetFormattedDates;
};

/**
 * Helper method Converts the date received from the server to Date widget acceptable format.
 *
 * @param {String} serverDateValue - The date in one of the Classification accepted date formats (See
 *            clsDateFormats)
 * @param {String} formatTypeIndex - the date type indicating from clsDateFormats which format the date will be.
 * @param {Boolean} isCstAttr - indicator of whether the attribute that owns the value is a Cst attribute or not
 * @return {String} The date in format acceptable to the AW Date widget (i.e. YYYY-MM-DDTHH:MM:SSXX:YY, where
 *         XX:YY is the timezone offset in hours and mins. ). It may have a - (minus) sign as well. e.g.
 *         2017-03-20T05:00:00-04:00 )
 */
// eslint-disable-next-line complexity
export let convertClsDateToAWDateWidgetFormat = function( serverDateValue, formatTypeIndex, isCstAttr ) {
    //If the attribute is from CST, we only use one format for the Date that comes back from server
    if( isCstAttr ) {
        // Default Values for Dates, in CST, are currently in a T seperated Date Format
        if( serverDateValue && !_.isNumber( serverDateValue ) && serverDateValue.substring( 10, 11 ) === 'T' ) {
            formatTypeIndex = exports.CST_DEFAULT_DATE_FORMAT_INDEX;
        } else {
            formatTypeIndex = exports.CST_DATE_FORMAT_INDEX;
        }
    }

    var awDateWidgetFormattedDate = {};

    if( serverDateValue && !_.isNumber( serverDateValue ) && serverDateValue !== '' ) {
        var inputServerDate = serverDateValue;

        var date = '';
        var hours = '';
        var minutes = '';
        var month = '';
        var seconds = '';
        var year = '';

        var setTimeEmpty = false;
        var dateFields;

        switch ( formatTypeIndex ) {
            case 0:
                // Format - 'yyyyMMddHHmmss'

                year = inputServerDate.substring( 0, 4 );
                month = inputServerDate.substring( 4, 6 );
                date = inputServerDate.substring( 6, 8 );
                hours = inputServerDate.substring( 8, 10 );
                minutes = inputServerDate.substring( 10, 12 );
                seconds = inputServerDate.substring( 12, 14 );

                break;
            case 1:
                // Format - 'yyMMddHHmmss'

                year = inputServerDate.substring( 0, 2 );
                month = inputServerDate.substring( 2, 4 );
                date = inputServerDate.substring( 4, 6 );
                hours = inputServerDate.substring( 6, 8 );
                minutes = inputServerDate.substring( 8, 10 );
                seconds = inputServerDate.substring( 10, 12 );

                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 2:
                // Format - 'ddMMyyyyHHmmss'

                date = inputServerDate.substring( 0, 2 );
                month = inputServerDate.substring( 2, 4 );
                year = inputServerDate.substring( 4, 8 );
                hours = inputServerDate.substring( 8, 10 );
                minutes = inputServerDate.substring( 10, 12 );
                seconds = inputServerDate.substring( 12, 14 );

                break;
            case 3:
                // Format - 'ddMMyyHHmmss'

                date = inputServerDate.substring( 0, 2 );
                month = inputServerDate.substring( 2, 4 );
                year = inputServerDate.substring( 4, 6 );
                hours = inputServerDate.substring( 6, 8 );
                minutes = inputServerDate.substring( 8, 10 );
                seconds = inputServerDate.substring( 10, 12 );

                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 4:
                // Format - 'dd.MM.yyyy HH:mm:ss'
                dateFields = inputServerDate.split( /\.| |:/ );
                date = dateFields[0];
                month = dateFields[1];
                year = dateFields[2];
                hours = dateFields[3];
                minutes = dateFields[4];
                seconds = dateFields[5];

                break;
            case 5:
                // // Format - 'dd.MM.yy HH:mm:ss'
                dateFields = inputServerDate.split( /\.| |:/ );
                date = dateFields[0];
                month = dateFields[1];
                year = dateFields[2];
                hours = dateFields[3];
                minutes = dateFields[4];
                seconds = dateFields[5];
                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 6:
                // Format - 'dd.MM.yyyy'
                dateFields = inputServerDate.split( '.' );
                date = dateFields[0];
                month = dateFields[1];
                year = dateFields[2];

                setTimeEmpty = true;

                break;
            case 7:
                // Format - 'dd.MM.yy'
                setTimeEmpty = true;
                dateFields = inputServerDate.split( '.' );
                date = dateFields[0];
                month = dateFields[1];
                year = dateFields[2];
                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 8:
                // Format - 'yyMMdd'

                year = inputServerDate.substring( 0, 2 );
                month = inputServerDate.substring( 2, 4 );
                date = inputServerDate.substring( 4, 6 );
                setTimeEmpty = true;

                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 9:
                // Format - 'yyyyMMdd'

                year = inputServerDate.substring( 0, 4 );
                month = inputServerDate.substring( 4, 6 );
                date = inputServerDate.substring( 6, 8 );
                setTimeEmpty = true;

                break;
            case 10:
                // Format - "" - (invalid case).
                console.error( 'Format - INVALID CASE' );

                break;
            case 11:
                // Format - 'MM/dd/yy HH:mm:ss'
                dateFields = inputServerDate.split( /\/| |:/ );
                month = dateFields[0];
                date = dateFields[1];
                year = dateFields[2];
                hours = dateFields[3];
                minutes = dateFields[4];
                seconds = dateFields[5];
                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 12:
                // Format - 'MM/dd/yy'
                setTimeEmpty = true;

                dateFields = inputServerDate.split( '/' );
                month = dateFields[0];
                date = dateFields[1];
                year = dateFields[2];

                // Get the year in YYYY
                year = exports.getYearNumber( year );

                break;
            case 13:
                // Format - 'dd-MMM-yyyy HH:mm'
                dateFields = inputServerDate.split( /-| |:/ );
                if ( dateFields.length > 1 ) {
                    date = dateFields[0];
                    month = dateFields[1];
                    year = dateFields[2];
                    hours = dateFields[3];
                    minutes = dateFields[4];
                } else {
                    //TODO: LCS-677701: Server returns date as 'YYYYmmddhhmmss' for formattype 13.
                    //Workaround till the defect is fixed. Otherwise, there is traceback and convertValues
                    //request doesn't match with attributes
                    date = inputServerDate.substring( 0, 2 );
                    month = inputServerDate.substring( 3, 6 );
                    year = inputServerDate.substring( 7, 11 );
                    hours = inputServerDate.substring( 12, 14 );
                    minutes = inputServerDate.substring( 15, 17 );
                }
                seconds = '00';

                // Get the month's corresponding MM format value
                month = exports.getMonthNumber( month );

                //In 11.6 we are getting different format for date in CST nodes than for 12.1,
                // so check if date is valid and if not try formatting it using 0 format
                var timeVerifyCst = year !== '' && month !== '' && date !== '';
                if( isCstAttr && !timeVerifyCst ) {
                    //0 format type code
                    year = dateFields[0];
                    month = dateFields[1];
                    date = dateFields[2];
                    hours = dateFields[3];
                    minutes = dateFields[4];
                    seconds = dateFields.length > 5 ? dateFields[5] : '';
                }

                if( month  === '' ) {
                    year = inputServerDate.substring( 0, 4 );
                    month = inputServerDate.substring( 4, 6 );
                    date = inputServerDate.substring( 6, 8 );
                    hours = inputServerDate.substring( 8, 10 );
                    minutes = inputServerDate.substring( 10, 12 );
                    seconds = inputServerDate.substring( 12, 14 );
                }

                break;
            case 14:
                // Format - 'yyyy-MM-ddTHH:MM:SS-TH:TM'
                dateFields = inputServerDate.split( /-| |:/ );
                year = dateFields[0];
                month = dateFields[1];
                date = dateFields[2].substring( 0, 2 );
                hours = dateFields[2].substring( 4, 5 );
                minutes = dateFields[3];
                // Ignore Timezone, as it is not used for static values

                break;
            default:
                // Do nothing
        } // End of Switch

        // Set the time params as "00"
        if( setTimeEmpty ) {
            hours = '00';
            minutes = '00';
            seconds = '00';
        }

        var timeVerify = year !== '' && month !== '' && date !== '';
        if( timeVerify && hours !== '' && minutes !== '' && seconds !== '' ) {
            var dateStr = year + '-' + month + '-' + date + 'T' + hours + ':' + minutes + ':' + seconds;
            awDateWidgetFormattedDate.dbValue = year + '-' + month + '-' + date + 'T' + hours + ':' + minutes +
                ':' + seconds + exports.getTimezoneOffsetInHours( dateStr );
            awDateWidgetFormattedDate.displayValue = year + '-' + month + '-' + date + ' ' + hours + ':' +
                minutes + ':' + seconds;
        } else {
            awDateWidgetFormattedDate.dbValue = inputServerDate;
            awDateWidgetFormattedDate.displayValue = inputServerDate;
        }
    }

    return awDateWidgetFormattedDate;
};

/**
 * @param {object} serverDateValue - server data value
 * @Return {Object} The date object in AW tile date format
 */
export let convertClsDateToAWTileDateFormat = function( serverDateValue ) {
    var awDateWidgetFormattedDate = {};
    var monthNames = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

    if( serverDateValue && serverDateValue !== '' ) {
        var inputServerDate = serverDateValue;

        var date = '';
        var hours = '';
        var minutes = '';
        var month = '';
        var seconds = '';
        var year = '';

        // Format - 'yyyyMMddHHmmss'

        if( serverDateValue.length === DATE_FORMAT_LENGTH ) {
            year = inputServerDate.substring( 0, 4 );
            month = inputServerDate.substring( 4, 6 );
            date = inputServerDate.substring( 6, 8 );
            hours = inputServerDate.substring( 8, 10 );
            minutes = inputServerDate.substring( 10, 12 );
            seconds = inputServerDate.substring( 12, 14 );
        }
        var dateVerify = year !== '' && month !== '' && date !== '';
        if( dateVerify && hours !== '' && minutes !== '' && seconds !== '' ) {
            var dateStr = year + '-' + month + '-' + date + 'T' + hours + ':' + minutes + ':' + seconds;
            awDateWidgetFormattedDate.dbValue = year + '-' + month + '-' + date + 'T' + hours + ':' + minutes +
                ':' + seconds + exports.getTimezoneOffsetInHours( dateStr );
            awDateWidgetFormattedDate.displayValue = date + '-' + monthNames[ Number( month - 1 ) ] + '-' + year +
                ' ' + hours + ':' + minutes;
        } else {
            awDateWidgetFormattedDate.dbValue = inputServerDate;
            awDateWidgetFormattedDate.displayValue = inputServerDate;
        }
    }

    return awDateWidgetFormattedDate;
};

/**
 * Enables getRootLevelPropertiesFromAttributes to loop for each complex value, generating a seperate entry, as required by CLS.
 * @param {Object} attribute - the attribute
 * @param {Object} values - the existing values
 * @param {Object} attributeVmo current attribute vmo zero
 * @param {Object} valIdx iterator
 * @returns {Object} values
 */
export let addComplexValuesToOutPut = function( attribute, values, attributeVmo, valIdx ) {
    // eslint-disable-next-line complexity
    var propertyValueObj = {
        internalValue: '',
        displayValue: ''
    };
    if( attribute.vmps && attribute.vmps[ 2 ] && ( attribute.vmps[ 2 ].names || attribute.vmps[ 2 ].propertyName ) ) {
        // Send unit to platform to convert there, upon saving.
        var selectedUnitDef = 0;
        var storageUnitDef = 0;
        var delimiter = ' |~| ';
        var displayValueString = '';
        _.forEach( attribute.vmps[ 2 ].unitDefs, function( unit ) {
            if( unit.displayName === attribute.vmps[ 2 ].uiValue ) {
                selectedUnitDef = unit;
            }
            if( unit.displayName === attribute.vmps[ 2 ].uiOriginalValue ) {
                storageUnitDef = unit;
            }
        } );
        var unitSystem = attribute.unitSystem.formatDefinition;
        var unitSystemString = '2' + unitSystem.formatModifier1.toString() + unitSystem.formatModifier2.toString(); //+ unitSystem.formatLength.toString();
        if( unitSystem.formatLength < 10 ) {
            var temp = '0' + unitSystem.formatLength.toString();
            unitSystemString += temp;
        } else if( unitSystem.formatLength > 10 ) {
            unitSystemString += unitSystem.formatLength.toString();
        }
        //build displayValueString
        displayValueString = unitSystemString + delimiter + storageUnitDef.unitID + delimiter + selectedUnitDef.unitID;
        if ( unitSystem && unitSystem.formatType === AXIS && valIdx > ROTATION_MINIMUM_INDEX && attributeVmo.dbValue && displayValueString !== EMPTYSTRING ) { // dont convert axis rotation values
            displayValueString = unitSystemString + delimiter + storageUnitDef.unitID + delimiter + storageUnitDef.unitID;
        }
        propertyValueObj = writeComplexPropertyValueObj( attributeVmo, displayValueString );
    }
    return propertyValueObj;
};

/**
 * Write PropertyValueObj for complex
 * @param {*} attributeVmo the vmo
 * @param {*} displayValueString the unit string
 * @returns {Object} values
 */
export let writeComplexPropertyValueObj = function( attributeVmo, displayValueString ) {
    var propertyValueObj = {};
    if ( attributeVmo.dbValue && displayValueString !== EMPTYSTRING ) {
        propertyValueObj.displayValue = displayValueString;
        propertyValueObj.internalValue = attributeVmo.dbValue.toString();
    } else {
        propertyValueObj.internalValue = ZEROSTRING;
        propertyValueObj.displayValue = ZEROSTRING;
    }
    return propertyValueObj;
};

/*
 * Check Image supported type
 *
 * @param {object} ticket - ticket
 * @Return true if the image is of supported type
 */
export let isSupportedImageType = function( ticket ) {
    var isSupported = false;
    // Check if the ticket is having one of the supported extensions
    if( ticket && ticket.length > 28 ) {
        const imageFormatType = [ 'GIF', 'JPG', 'JPEG', 'PNG', 'BMP', 'SVG', 'PDF' ];
        var n = ticket.lastIndexOf( '.' );
        var ticketExt = ticket.substring( n + 1 ).toUpperCase();
        if( imageFormatType.indexOf( ticketExt ) > -1 ) {
            isSupported = true;
        }
    }

    return isSupported;
};

/*
 * Checks if an array has empty values
 *
 * @param {Object-Array} arrayOfPropertyObjects - array of property objects, which hold values
 * @return true if the array has empty values
 */
export let hasEmptyValues = function( arrayOfPropertyObjects ) {
    var hasEmpty = false;
    if( !_.isEmpty( arrayOfPropertyObjects ) ) {
        for( var valIdx in arrayOfPropertyObjects ) {
            if( !_.isEmpty( arrayOfPropertyObjects[ valIdx ] ) ) {
                if( arrayOfPropertyObjects[ valIdx ].internalValue === '' ) {
                    hasEmpty = true;
                }
            }
        }
    }
    return hasEmpty;
};

/*
 * Simplified is null or empty function, which can handle both arrays and non-array variables
 *
 * @param {Array or Primitive} varToCheck - the variable to check if null or empty
 * @return true if the variable is null or empty
 */
export let isNullOrEmpty = function( varToCheck ) {
    var isNullOrEmpty = false;

    if( _.isArray( varToCheck ) ) {
        isNullOrEmpty = _.isEmpty( varToCheck );
    } else if( varToCheck === null || typeof varToCheck === 'undefined' || varToCheck === '' ) {
        isNullOrEmpty = true;
    }

    return isNullOrEmpty;
};
/**
 * Function to return properties object with given parameters
 * @param {*} classId The class Id
 * @param {*} className The class name
 * @param {*} classType The class type
 * @returns {Object} properties
 */
export let generatePropertiesForClassInfo = function( classId, className, classType ) {
    return [ {
        propertyId: 'CLASS_ID',
        propertyName: '',
        values: [ {
            internalValue: classId,
            displayValue: classId
        } ]
    }, {
        propertyId: 'CLASS_NAME',
        propertyName: '',
        values: [ {
            internalValue: className,
            displayValue: className
        } ]

    }, {
        propertyId: 'CLASS_TYPE',
        propertyName: '',
        values: [ {
            internalValue: classType,
            displayValue: classType
        } ]
    } ];
};

//TODO
//This function could be used to replace getPropertyValue, in classifyFullViewService and PanelService
//Not doing this now, as we are in endgame for AW42
/*
 * Gets the value of a property, from our generic properties list, using a property string id
 *
 * @param {Object-Array} properties - the generic property array
 * @param {String} propertyId - the string property id to search for
 * @return the value of the property
 */
export let getPropertyValueFromArray = function( properties, propertyId ) {
    var propValue = '';
    _.forEach( properties, function( prop ) {
        if( prop.propertyId === propertyId ) {
            propValue = prop.values[ 0 ].displayValue;
        }
    } );
    return propValue;
};

/*
 * Gets the values of a specific attribute, owned by a specific instance, of a formatted cardinal block
 *
 * @param {Object} formattedCardBlock - the formatted cardinal block, from which the value will be abstracted
 * @param {Integer} cardinalIndex - the index of the instance we want to get the value from (starting at 1)
 * @param {String} attributeName - the name of the attribute we want to get the value of
 * @return {Object} Object containing dbValue, displayValue, and uiValue
 */
export let getAttributeValuesFromInstance = function( formattedCardBlock, cardinalIndex, attributeId ) {
    var outputValues = {
        dbValue: [ '' ],
        displayValues: [ '' ]
    };
    var actualIndex = cardinalIndex - 1;
    if( formattedCardBlock.hasBlockChildren && formattedCardBlock.instances.length > 0 && formattedCardBlock.cardinalController ) {
        var cardInstance = formattedCardBlock.instances[ actualIndex ];
        var instanceChildren = cardInstance.children;
        var attribute = null;
        _.forEach( instanceChildren, function( child ) {
            if( child.id === attributeId ) {
                attribute = child;
            }
        } );
        if( !exports.isNullOrEmpty( attribute ) ) {
            outputValues.dbValue = attribute.vmps[ 0 ].dbValue;
            outputValues.displayValues = attribute.vmps[ 0 ].displayValues;
        }
    }

    return outputValues;
};


/**
 * @deprecated Found during test coverage, possibly dead code
 * This method and feedback service retuns feedback associated to BIO Service
 *
 * Host object feedback message service
 *
 * @param {Object} data - data message
 */

export let sendEventToHost = function( data ) {
    if( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        var curHostedComponentId = appCtxSvc.getCtx( 'aw_hosting_state.currentHostedComponentId' );
        if( curHostedComponentId === 'com.siemens.splm.client.classification.classify' ) {
            if( data.createdChangeObject !== null ) {
                var feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
                var objectRef = objectRefSvc.createBasicRefByModelObject( data.createdChangeObject );
                feedbackMessage.setFeedbackTarget( objectRef );
                feedbackMessage.setFeedbackString( 'Classify Panel Successfully Opened/created' );
                var feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
                feedbackProxy.fireHostEvent( feedbackMessage );
            }
        }
    }
};

/**
 * @deprecated Found during test coverage, possibly dead code
 * Update selected releases
 *
 * @param {ViewModelProperty} prop - ViewModelProperty,
 * @param {Object} adminCtx admin context
 */

export let updateSelectedReleases = function( prop, adminCtx ) {
    let isValid = true;
    if( prop.propApi.validationApi ) {
        isValid = prop.propApi.validationApi( prop.dbValue );
    }
    if( isValid ) {
        adminCtx.releases.selected = adminCtx.releases.expandedList;
        adminCtx.releases.isDirty = true;
        // var prefs = prop.dbValue.split( ', ' );
        _.forEach( adminCtx.releases.selected, function( release ) {
            release.selected = 'false';
        } );
        _.forEach( prop.dbValue, function( pref ) {
            var jdx = _.findIndex( adminCtx.releases.selected, function( release ) {
                return release.internalName === pref;
            } );
            if ( adminCtx.releases.selected[ jdx ] ) {
                adminCtx.releases.selected[ jdx ].selected = 'true';
            }
        } );
    }
};

/**
 * @deprecated Found during test coverage, possibly dead code
 * Reset selected releases to original list
 *
 * @param {ViewModelProperty}prop - the view model property
 */
export let resetReleases = function( data, prop ) {
    getReleasesExpanded( data, prop, true );
};

/**
 * @deprecated Found during test coverage, possibly dead code
 * Add releases from preferences to LOV
 *
 * @param {ViewModelProperty} prop - the view model property
 * @param {Boolean} reset true if reset, false otherwise
 */
let getReleasesExpanded = function( data, prop, reset ) {
    var adminCtx = appCtxSvc.getCtx( 'clsTab' );
    var releasesExpandedList = [];
    adminCtx.isDirty = false;
    prop.isDirty = false;
    if ( !adminCtx.releases || !adminCtx.releases.expandedList || adminCtx.releases.expandedList.length === 0 || reset ) {
        _.forEach( adminCtx.eReleases, function( release ) {
            var tmpProp = {
                internalName: release.internalName,
                displayName: release.displayName,
                selected: 'true'
            };
            releasesExpandedList.push( tmpProp );
        } );
        if ( !adminCtx.releases ) {
            adminCtx.releases = {};
        }
        adminCtx.releases.expandedList = releasesExpandedList;
        adminCtx.isDirty = true;
        prop.isDirty = true;
        appCtxSvc.updateCtx( 'clsTab', adminCtx );
    } else {
        if ( !adminCtx.releases ) {
            adminCtx.releases = {};
        }
        releasesExpandedList = adminCtx.releases.expandedList;
    }
    data.releasesExpandedList = releasesExpandedList;

    var releasesSelected = _.filter( releasesExpandedList, function( o ) {
        return o.selected === 'true';
    } );
    adminCtx.releases.selected = releasesSelected;
    if ( releasesSelected ) {
        adminCtx.isDirty = true;
        prop.isDirty = true;
        appCtxSvc.updateCtx( 'clsTab', adminCtx );
    }
    data.releasesSelected = releasesSelected;
    var db = [];
    var display = [];
    var displayStr = '';
    if ( releasesExpandedList && releasesExpandedList.length > 0 ) {
        _.forEach( releasesExpandedList, function( release ) {
            db.push( release.internalName );
            display.push( release.displayName );
            displayStr += displayStr === '' ? '' : ', ';
            displayStr += release.displayName;
        } );
    }

    prop.dbValue = db;
    prop.uiValues = display;
    prop.displayValues = display;
    prop.uiValue = displayStr;
    return data;
};

/**
 * @deprecated Found during test coverage, possibly dead code
 * Creates initial list of releases
 *
 * @param {Object} data data
 */

export let createReleaseList = function( data ) {
    var prop = data.Releases;
    var context = appCtxSvc.getCtx( 'clsTab' );
    prop.propApi.fireValueChangeEvent = function( ) {
        exports.updateSelectedReleases( prop, context );
    };

    // Dont reset if in location with classification on sub panel
    if ( data.eventMap ) {
        var keys = Object.keys( data.eventMap );
        if ( keys[0] === 'performSearch.selectionChangeEvent' ) {
            getReleasesExpanded( data, prop, false );
        } else {
            getReleasesExpanded( data, prop, true );
        }
    } else {
        getReleasesExpanded( data, prop, true );
    }

    prop.isArray = true;
    prop.lovApi = {};
    prop.resetEnabled = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        var lovEntries = [];
        _.forEach( context.releases.expandedList, function( release ) {
            let lovEntry = {
                propDisplayValue: release.displayName,
                propInternalValue: release.internalName,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: release.selected === 'true',
                disabled: false
            };
            lovEntries.push( lovEntry );
        } );
        return deferred.resolve( lovEntries );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        deferred.resolve( null );
    };
    prop.lovApi.validateLOVValueSelections = function( lovEntries ) { // eslint-disable-line no-unused-vars
        // Either return a promise or don't return anything. In this case, we don't want to return anything
    };
    prop.hasLov = true;
    prop.isSelectOnly = true;
    prop.emptyLOVEntry = false;
    return data;
};

/**
 * @deprecated Found during test coverage, possibly dead code
 * Formats the classification class Image attachments so that they can be displayed in the UI. Currently, only
 * static images with .GIF, .JPG, .JPEG, .PNG and .BMP extensions are supported The support for other
 * attachments such as PDF, 3-d images (.hpg) is currently not there.
 *
 * @param {Object} datasetFilesOutput - The view-model data object
 */
export let formatImageAttachments = function( datasetFilesOutput ) {
    var imageURLs = [];
    var viewDataArray = [];
    if( datasetFilesOutput && datasetFilesOutput.length > 0 ) {
        var hasMoreImage = false;
        if( datasetFilesOutput.length > 1 ) {
            hasMoreImage = true;
        }
        var imageIndex = 0;
        _.forEach( datasetFilesOutput, function( dsOutputArrElement ) {
            var ticket = dsOutputArrElement.ticket;
            var n = ticket.lastIndexOf( '.' );
            var ticketExt = ticket.substring( n + 1 ).toUpperCase();
            if( exports.isSupportedImageType( ticket ) ) {
                var viewer = ticketExt === 'PDF' ? 'Awp0PDFViewer' : 'Awp0ImageViewer';
                var thumbnailUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                    fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
                imageURLs.push( thumbnailUrl );

                var viewerData = {
                    datasetData: {},
                    fileData: {
                        file: {
                            cellHeader1: fmsUtils.getFilenameFromTicket( ticket )
                        },
                        fileUrl: thumbnailUrl,
                        fmsTicket: ticket,
                        viewer: viewer
                    },
                    hasMoreDatasets: hasMoreImage,
                    imageIndex: imageIndex
                };
                viewDataArray.push( viewerData );
                imageIndex++;
            }
        } );
    }
    return {
        imageURLs,
        viewDataArray
    };
};

/**
 * Returns an integer of a string attribute id by removing the prefix from the beginning of it, if has one
 *
 * @param {String} attributeId - The string attributeId to convert to integer
 * @returns {Integer} attribute
 */
export let getAttributeIntegerFromString = function( attributeId ) {
    var attrIdInt = 0;
    var tempAttributeId = attributeId;

    var prefix = attributeId.substring( 0, 4 );
    if( prefix === 'sml0' ) {
        tempAttributeId = tempAttributeId.substring( 4 );
    }
    attrIdInt = parseInt( tempAttributeId );
    return attrIdInt;
};

/**
 * Overrides the given attribute in the attrs
 *
 * @param {Object} attrs - attrs
 * @param {Object} attribute - attribute
 * @return {Array} returns the updated attrs
 */
export const updateAttrsList = function( attrs, attribute ) {
    // It returns the attrs array overriding the given attribute in the array.
    attrs.forEach( attr => {
        if ( attr.children && attr.children.length > 0 ) {
            attr.children = updateAttrsList( attr.children, attribute );
        }
    } );
    return attrs.map( attr => attr.id === attribute.id ? attribute : attr );
};

export default exports = {
    typeEnumMap,
    clsDateFormats,
    DATE,
    DATE_ARRAY,
    loadClassChildren,
    KL_HASH_STR,
    KL_SEPARATOR,
    CLEARED_WIDGET_DATE_CHROME,
    CLEARED_WIDGET_DATE_IE,
    CLEARED_WIDGET_DATE_FF,
    FORMAT_WITH_MMM_DATE,
    CST_DATE_FORMAT_INDEX,
    CST_DEFAULT_DATE_FORMAT_INDEX,
    getAttributeValuesFromTable,
    getClsUtilValueMap,
    getAttributeIntegerFromString,
    getAttributeValues,
    convertValue,
    formatAttributeValue,
    formatImageAttachments,
    getUnitSystem,
    getParentIds,
    checkIfSupportedTcVersionForSort,
    checkIfSupportedTcVersion,
    getConcatenatedValues,
    getYearNumber,
    getMonthNumber,
    getTimezoneOffsetInHours,
    convertClsDateArrayToAWDateWidgetFormat,
    convertClsDateToAWDateWidgetFormat,
    convertClsDateToAWTileDateFormat,
    createReleaseList,
    isSupportedImageType,
    addComplexValuesToOutPut,
    hasEmptyValues,
    isNullOrEmpty,
    generatePropertiesForClassInfo,
    getPropertyValueFromArray,
    getAttributeValuesFromInstance,
    parseValues,
    sendEventToHost,
    resetReleases,
    updateAttrsList,
    updateSelectedReleases,
    getSeparatedDispValAndUnitNameForNumericAttr,
    writeComplexPropertyValueObj
};
