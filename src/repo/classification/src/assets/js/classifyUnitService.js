// Copyright (c) 2022 Siemens

/**
 * Defines {@link classifyUnitService}
 *
 * @module js/classifyUnitService
 */
import _ from 'lodash';
import classifyDefinesService from 'js/classifyDefinesService';
import classifyUtils from 'js/classifyUtils';
import classifySvc from 'js/classifyService';
import uwPropertyService from 'js/uwPropertyService';
import soaService from 'soa/kernel/soaService';

var exports = {};


//Type of classification attribute
const CSTPREFIX = 'cst0';
export const BLOCK = 'Block';
export const CARDINAL = 'Cardinal';
export const COMPLEX = 'Complex';
export const PRIMITIVE = 'Primitive';
export const COMPLEXPROPERTY = 4;

export const CLS_ATTRIBUTE_TYPE = {
    BLOCK,
    CARDINAL,
    COMPLEX,
    PRIMITIVE
};

/**
 * Helper method to validate whether attribute is cst attribute.
 * True - if cst attribute else false
 *
 * @param {Object} attribute - the classification attribute
 *
 * @return {Boolean} isCstAttribute
 */
let isCstAttribute = function( attribute ) {
    var isCstAttr = false;
    try {
        var tempAttrId = attribute.id;
        var tempAttrPrefix = attribute.prefix;
        isCstAttr = Boolean( tempAttrId.substring( 0, 4 ) === 'cst0' || tempAttrPrefix.substring( 0, 4 ) === 'cst0' );
    } catch ( err ) {
        console.error( err );
    }
    return isCstAttr;
};

var convertVMO = function( attribute, conversionUnit, vmp ) {
    try {
        if( vmp.dbValue === null || vmp.type === classifyUtils.DATE && vmp.dbValue < 0 ) {
            vmp.dbValue = '';
        }
        let input = {
            inputValues: [],
            options: 0
        };

        let attrValue = vmp.dbValue;
        if ( attrValue ) {
            if ( Array.isArray( attrValue ) ) {
                attrValue.forEach( value => {
                    input.inputValues.push( value.toString() );
                } );
            } else {
                input.inputValues.push( attrValue.toString() );
            }
        } else {
            input.inputValues.push( '' );
        }

        let unitSystem;
        //By this point, unitSystem represents the new/desired unit system.
        if ( !conversionUnit ) {
            unitSystem = vmp.nonMetricFormat;
            if ( unitSystem ) {
                input.inputUnit = vmp.metricFormat.unitName;
                if ( !vmp.originalSystem ) {
                    vmp.originalSystem = vmp.metricFormat;
                }
            } else {
                input.inputUnit = '';
            }
        } else {
            unitSystem = vmp.metricFormat;
            if ( unitSystem ) {
                input.inputUnit = vmp.nonMetricFormat.unitName;
                if ( !vmp.originalSystem ) {
                    vmp.originalSystem = vmp.nonMetricFormat;
                }
            } else {
                input.inputUnit = '';
            }
        }

        if ( unitSystem.formatDefinition.formatType > COMPLEXPROPERTY ) {
            input.outputFormat = { formatType: 2, formatModifier1: 0, formatModifier2: 0, formatLength: 7 };
        } else {
            input.outputFormat = unitSystem.formatDefinition;
        }

        input.outputUnit = unitSystem.unitName;
        return input;
    } catch ( err ) {
        console.error( err );
    }
};


let convertSingleAttr = function( attribute, conversionUnit ) {
    let vmp = attribute.vmps[ 0 ];
    return convertVMO( attribute, conversionUnit, vmp );
};

let populateAttributeValue = function( attribute, newValue ) {
    let dispValues = [];
    if ( attribute.hasLov ) {
        let keyLOVDef = attribute.lovApi.keyLOVDefinition;
        _.forEach( newValue, function( dbVal ) {
            _.forEach( keyLOVDef.keyLOVEntries, function( entry ) {
                if ( entry.keyLOVkey === dbVal ) {
                    dispValues.push( keyLOVDef.keyLOVOptions === 1 ? entry.keyLOVValue :
                        entry.keyLOVkey + ' ' + entry.keyLOVValue );
                }
            } );
        } );
    } else {
        dispValues = newValue;
    }

    if ( attribute.isArray ) {
        if( attribute.displayValsModel.length > 0 ) {
            for ( let i = 0; i < attribute.displayValsModel.length; i++ ) {
                attribute.displayValsModel[ i ].displayValue = dispValues[ i ];
            }
        } else if ( dispValues.length > 0 ) {
            attribute.displayValsModel.push( { displayValue: dispValues[0] } );
        }
    }
    attribute.value = newValue;
    attribute.displayValues = dispValues;
    attribute.dbValue = newValue;
    attribute.dbValues = newValue;
    attribute.uiValue = dispValues[0];
};

let applyConvertedValue = function( attribute, convertedValue, panelMode, unitSystem, val ) {
    attribute.unitSystem = unitSystem ? attribute.vmps[ 0 ].metricFormat : attribute.vmps[ 0 ].nonMetricFormat;

    // return if attribute doesn't have non-metric unit
    if( attribute.vmps[0].metricFormat && attribute.vmps[0].metricFormat.unitName !== ''
    && attribute.vmps[0].nonMetricFormat && attribute.vmps[0].nonMetricFormat.unitName === ''
    && _.isEqual( attribute.vmps[ 0 ].uiValue, convertedValue[ 0 ] ) ) {
        return;
    }

    if ( convertedValue && convertedValue[0] && !_.isEqual( attribute.vmps[ 0 ].value, convertedValue ) ) {
        if ( attribute.vmps[ 0 ].type !== classifyUtils.DATE && attribute.vmps[ 0 ].type !== classifyUtils.DATE_ARRAY ) {
            //for complex attribute, update correct attribute vmps object
            if( getAttributeType( attribute ) === CLS_ATTRIBUTE_TYPE.COMPLEX ) {
                populateAttributeValue( attribute.vmps[ val ], convertedValue );
            } else {
                populateAttributeValue( attribute.vmps[ 0 ], convertedValue );
            }
        }
    }

    if ( panelMode !== -1 ) {
        if ( unitSystem ? ( attribute.origAttributeInfo.options & classifySvc.ATTRIBUTE_FIXED ) !== 0 : ( attribute.origAttributeInfo.options & classifySvc.ATTRIBUTE_FIXED2 ) !== 0 ) {
            uwPropertyService.setIsEditable( attribute.vmps[ 0 ], false );
        } else {
            uwPropertyService.setIsEditable( attribute.vmps[ 0 ], true );
        }
    }

    var useDefault = false;
    var attrValue = attribute.vmps[0].value !== null ? attribute.vmps[0].value[0] : null;
    var attrConvertedValue = convertedValue !== undefined ? convertedValue[0] : undefined;
    // eslint-disable-next-line no-extra-parens
    if( ( attrValue === null || attrConvertedValue === undefined ) || ( attribute.unitSystem.unitName === '' && attrValue !== null && attrValue === attrConvertedValue ) ) {
        useDefault = true;
    }

    if( useDefault ) {
        let defaultValue = attribute.unitSystem.defaultValue ? attribute.unitSystem.defaultValue : null;
        if ( defaultValue ) {
            populateAttributeValue( attribute.vmps[ 0 ], _.isArray( defaultValue ) ? defaultValue : [ defaultValue ] );
        }
    }

    attribute.vmps[ 2 ].propertyDisplayName = attribute.unitSystem.unitName;
    attribute.vmps[ 2 ].uiOriginalValue = attribute.unitSystem.unitName;
    attribute.vmps[ 2 ].uiValue = attribute.unitSystem.unitName;
    attribute.vmps[ 2 ].dbValue = attribute.unitSystem.unitName;
    attribute.vmps[ 2 ].value = convertedValue;
    attribute.vmps[ 2 ].displayValues = convertedValue;

    attribute.updatedUnits = true;
};

/**
 * Helper method to set converted values for the complex attribute type
 *
 * @param {Object} data - the viewmodel data object
 * @param {Object} attribute - the classification attribute
 * @param {Object} indexRef - the index
 *
 */
let setConvertedValForComplexType = function( attribute, convertedValues, unitSystem, panelMode, indexRef ) {
    var val = 0;
    attribute.vmps.forEach( ( vmo ) => {
        if ( val !== 1 && val !== 2 ) {
            applyConvertedValue( attribute, convertedValues[ indexRef.index ].convertedValues, panelMode, unitSystem, val );
            indexRef.index++;
        }
        val++;
    } );
};

/**
 * Helper method to set converted values for the block attribute type
 *
 * @param {Object} attribute - the classification attribute
 * @param {Object} convertedValues - converted values
 * @param {Object} unitSystem  - unit system
 * @param {Object} panelMode - panelMode
 * @param {Object} indexRef - the index
 */
let setConvertedValForBlockType = function( attribute, convertedValues, unitSystem, panelMode, indexRef ) {
    var attributes = attribute.children ? attribute.children : [];
    setConvertedValues( attributes, convertedValues, unitSystem, panelMode, indexRef );
};

/**
 * Helper method to set converted values for the block attribute type
 *
 * @param {Object} attributes - the classification attribute
 * @param {Object} convertedValues - converted values
 * @param {Object} unitSystem  - unit system
 * @param {Object} panelMode - panelMode
 * @param {Object} indexRef - the index
 */
let setConvertedValues = function( attributes, convertedValues, unitSystem, panelMode, indexRef ) {
    let attributeType = CLS_ATTRIBUTE_TYPE.PRIMITIVE;

    attributes.forEach( attribute => {
        attributeType = getAttributeType( attribute );

        switch ( attributeType ) {
            case CLS_ATTRIBUTE_TYPE.BLOCK:
                // Only handled for traditional block/view as part of this defect
                // Not handled for CST cardinal/polymeric block
                // TODO : Need to handle all use case for CST block
                if( !isCstAttribute( attribute ) )   {
                    setConvertedValForBlockType( attribute, convertedValues, unitSystem, panelMode, indexRef );
                }
                break;
            case CLS_ATTRIBUTE_TYPE.COMPLEX:
                setConvertedValForComplexType( attribute, convertedValues, unitSystem, panelMode, indexRef );
                break;
            case CLS_ATTRIBUTE_TYPE.PRIMITIVE:
                applyConvertedValue( attribute, convertedValues[ indexRef.index ].convertedValues, panelMode, unitSystem );
                indexRef.index++;
                break;
        }
    } );
};

let getAttributeType = function( attribute ) {
    let attributeType = PRIMITIVE;

    if ( attribute.type === BLOCK ) {
        attributeType = BLOCK;
    } else if ( attribute.isCardinalControl ) {
        attributeType = CARDINAL;
    } else if ( attribute.unitSystem && attribute.unitSystem.formatDefinition && attribute.unitSystem.formatDefinition.formatType > COMPLEXPROPERTY ) {
        attributeType = COMPLEX;
    } else {
        attributeType = PRIMITIVE;
    }

    return attributeType;
};

let getConvertValReqForBlockType = function( attribute, unitSystem, conversionRequest ) {
    let attributes = attribute.children ? attribute.children : [];
    getConvertValReqHelper( attributes, unitSystem, conversionRequest );
};

/**
 * We are using below function to get converison request from the given input
 * @param {string} attributes list of attributes for selected class
 * @param {string} unitSystem Current unit system
 * @param {Array} conversionRequest Output param. input request for the SOA convertValues
 */
let getConvertValReqHelper = function( attributes, unitSystem, conversionRequest ) {
    let attributeType = CLS_ATTRIBUTE_TYPE.PRIMITIVE;

    attributes.forEach( attribute => {
        attributeType = getAttributeType( attribute );

        switch ( attributeType ) {
            case CLS_ATTRIBUTE_TYPE.BLOCK:
                // Only handled for traditional block/view as part of this defect
                // Not handled for CST cardinal/polymeric block
                // TODO : Need to handle all use case for CST block
                if ( !isCstAttribute( attribute ) ) {
                    getConvertValReqForBlockType( attribute, unitSystem, conversionRequest );
                }
                break;
            case CLS_ATTRIBUTE_TYPE.COMPLEX:
                getConvertValReqForComplexType( attribute, unitSystem, conversionRequest );
                break;
            case CLS_ATTRIBUTE_TYPE.PRIMITIVE:
                var result = convertSingleAttr( attribute, unitSystem );
                if ( result ) { conversionRequest.push( result ); }
                break;
            case CLS_ATTRIBUTE_TYPE.CARDINAL:
                //  Not handling for CST cardinal/polymeric block
                // TODO : Need to handle all use case for CST block
                break;
        }

        //Convert unit displayname to unitId
        if ( attributeType !== CLS_ATTRIBUTE_TYPE.BLOCK ) {
            _.forEach( conversionRequest, function( convReq )  {
                _.forEach( attribute.vmps[ 2 ].unitDefs, function( unit ) {
                    if ( unit.displayName === convReq.inputUnit ) {
                        convReq.inputUnit = unit.unitID;
                    }
                    if ( unit.displayName === convReq.outputUnit ) {
                        convReq.outputUnit = unit.unitID;
                    }
                } );
            } );
        }
    } );
};


/**
 * Helper method to create convert value request for complex attribute type
 *
 * @param {Object} data - the viewmodel data object
 * @param {Object} attribute - the classification attribute
 * @param {Object} conversionRequest - the convert value request object
 *
 * @return {Object} the convert value request for complex type
 */
let getConvertValReqForComplexType = function( attribute, unitSystem, conversionRequest ) {
    var idx = 0;
    _.forEach( attribute.vmps, function( vmp ) {
        if ( idx !== 1 && idx !== 2 ) {
            conversionRequest.push( convertVMO( attribute, unitSystem, vmp ) );
        }
        idx++;
    } );
};


/**
 * We are using below function to convert the attribute values after selecting unit.
 * @param {string} classifyState Struct containing class information
 * @param {string} unitSystem Current unit system
 */
export let selectUnitSystem = function( context, unitSystem ) {
    let conversionRequest = [];
    var classifyState = context.classifyState;
    var responseState = context.responseState;
    var data = context.data;

    getConvertValReqHelper( classifyState.value.attrs, unitSystem, conversionRequest );

    let request = {
        valueConversionInputs: conversionRequest
    };
    soaService.postUnchecked( 'Classification-2016-03-Classification', 'convertValues', request )
        .then( function( response ) {
            if ( !response.partialErrors ) {
                let convertedAttrs = [ ...classifyState.value.attrs ];
                let indexRef = { index: 0 };
                setConvertedValues( convertedAttrs, response.convertedValues, unitSystem, classifyState.value.panelMode, indexRef );
                data.keyLOVDefinitionMapResponse = responseState.response.keyLOVDescriptors;
                data.unitSystem = classifyState.value.currentUnitSystem;
                data.unitSystem.dbValue = unitSystem;
                data.selectedClass = classifyState.value.selectedClass;
                classifySvc.setDefaultValuesAndUnitSystem( data, convertedAttrs, unitSystem, classifyState );
                const tmpState = { ...classifyState.value };
                tmpState.attrs = convertedAttrs;
                tmpState.currentUnitSystem.dbValue = unitSystem;
                tmpState.updateMetric = true;
                classifyState.update( tmpState );
            }
        } );
};

export default exports = {
    selectUnitSystem
};
