// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines {@link AwClsList}
 *
 * @module js/AwClsListService
 */
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';

export let NOTCOMPLEXPROPERTY = 4;
export let COMPLEXPROPERTY = 5;
export let NODATARESULT = '0';
export let CSTPREFIX = 'cst0';
export let COMPLEXFORMATTYPE = 2;
export let FORMATTYPE = 2;
export let MODIFIER1 = 0;
export let COMPLEXMODIFIER2 = 6;
export let COMPLEXFORMATLENGTH = 12;
export let EXTRATIMELENGTH = 4;
export let FORMATLENGTH = 12;
export let INVALID_FORMAT_MOD = 0;
export let DEFAULT_FORMAT_MOD = 1;
export let AXIS = 9;
export let UNITVMO = 2;

var exports = {};


let populateUnitValues = function( unitLink, newUnitName, conversion ) {
    _.forEach( unitLink.lovApi, function( unit ) {
        if ( unit.propDisplayValue === newUnitName ) {
            conversion.outputUnit = unit.unitID;
        }
        if ( unit.propDisplayValue === unitLink.propertyDisplayName ) {
            conversion.inputUnit = unit.unitID;
        }
    } );

    if ( _.isArray( unitLink.value ) ) {
        _.forEach( unitLink.value, function( value ) {
            conversion.inputValues.push( value.toString() );
        } );
    } else {
        conversion.inputValues.push( unitLink.value.toString() );
    }
};

let convertSingleAttr = function( unitLink, parentAttribute, newUnitName ) {
    try {
        if ( parentAttribute.type !== 'Block' && !parentAttribute.isCardinalControl && parentAttribute.unitSystem.formatDefinition.formatType < COMPLEXPROPERTY ) {
            var conversion = {
                inputValues: [],
                inputUnit : 'input',
                outputUnit : 'output',
                options: 0
            };

            populateUnitValues( unitLink, newUnitName, conversion );

            conversion.outputFormat = parentAttribute.unitSystem.formatDefinition;
            if ( conversion.outputFormat.formatModifier1 < INVALID_FORMAT_MOD ) {
                conversion.outputFormat.formatModifier1 = DEFAULT_FORMAT_MOD;
            }
            if ( conversion.outputFormat.formatModifier2 < INVALID_FORMAT_MOD ) {
                conversion.outputFormat.formatModifier2 = DEFAULT_FORMAT_MOD;
            }
            return [ conversion ];
        }

        //TO DO FOR COMPLEX ATTRIBUTES
        return;
    } catch ( err ) {
        console.error( err );
    }
};

export let updateUnitValue = function( unitLink, newUnitValue, newValue ) {
    let tmpUnit = { ...unitLink.value };
    tmpUnit.propertyName = newUnitValue;
    tmpUnit.propertyDisplayName = newUnitValue;
    tmpUnit.uiOriginalValue = newUnitValue;
    tmpUnit.uiValue = newUnitValue;
    tmpUnit.dbValue = newUnitValue;
    tmpUnit.valueUpdated = true;
    if ( newValue ) {
        tmpUnit.value = newValue[0];
    }
    tmpUnit.displayValues = [];
    tmpUnit.displayValues[0] = tmpUnit.value;
    tmpUnit.value = { ...tmpUnit };
    unitLink.update( tmpUnit );
};

export let updateUnit = function( unitLink, value ) {
    unitLink.propertyName = value;
    unitLink.uiValue = value;
    return unitLink;
};

export let convertValues = function( data, attr, unitLink, parentAttribute, updateMode ) {
    if ( updateMode ) {
        parentAttribute.vmps[ 2 ].uiValue = data.eventData.propScope.propDisplayValue;
        updateUnitValue( unitLink, data.eventData.propScope.propDisplayValue );
    } else {
        var request = {
            valueConversionInputs: convertSingleAttr( unitLink.value, parentAttribute, data.eventData.propScope.propDisplayValue )
        };
        if ( request && request.valueConversionInputs ) {
            var inp = request.valueConversionInputs[ 0 ].inputUnit;
            var out = request.valueConversionInputs[ 0 ].outputUnit;
            if ( inp !== out && request.valueConversionInputs[ 0 ].inputValues && request.valueConversionInputs[ 0 ].inputValues[ 0 ] > 0 &&
                inp !== '' && out !== '' ) {
                soaService.postUnchecked( 'Classification-2016-03-Classification', 'convertValues', request )
                    .then( function( response ) {
                        if ( !response.partialErrors && response.convertedValues[ 0 ].convertedValues[ 0 ].toString() !== NODATARESULT ) {
                            attr.update( response.convertedValues[ 0 ].convertedValues );
                            updateUnitValue( unitLink, data.eventData.propScope.propDisplayValue, response.convertedValues[ 0 ].convertedValues );
                        } else {
                            data.dispatch( { path:'data.unitLink.uiValue', value: unitLink.value.uiValue } );
                        }
                    } );
            }else if ( inp === out && request.valueConversionInputs[ 0 ].inputValues && request.valueConversionInputs[ 0 ].inputValues[ 0 ] > 0 &&
                inp !== '' && out !== '' ) {
                attr.update( unitLink.value.value );
                updateUnitValue( unitLink, unitLink.value.propertyName );
            }
        }
    }
};

export let loadUnits = function( attribute, unitLink ) {
    let units = [];
    _.forEach( unitLink.value.lovApi, function( name ) {
        units.push( {
            propDisplayValue: name.propertyDisplayName,
            propInternalValue: name.propertyDisplayName,
            attrId: attribute.name,
            selected: false
        } );
    } );
    return units;
};

export let initialize = function( unitLink ) {
    return unitLink.value;
};

export default exports = {
    convertValues,
    initialize,
    loadUnits,
    updateUnit,
    updateUnitValue
};
