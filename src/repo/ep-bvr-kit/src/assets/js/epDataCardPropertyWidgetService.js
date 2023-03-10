// Copyright (c) 2022 Siemens

import soaSvc from 'soa/kernel/soaService';
import awPromiseSvc from 'js/awPromiseService';

let _categoryList;

/**
 *
 * @param {String} uid uid
 * @returns{Array} categoryList
 */
function getCategoryList( uid ) {
    if ( !_categoryList || _categoryList && _categoryList.length === 0 ) {
        return soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', getCategoryLovInput( uid ) ).then( function( response ) {
            if ( response && response.lovValues && Array.isArray( response.lovValues ) ) {
                response.lovValues.forEach( function( lov ) {
                    lov.dispValue = lov.propDisplayValues.lov_values[0];
                    lov.propDisplayValue = lov.propDisplayValues.lov_values[0];
                    lov.propInternalValue = lov.propInternalValues.lov_values[0];
                    if ( !_categoryList ) {
                        _categoryList = [];
                    }
                    _categoryList.push( lov );
                } );

                return [ ... _categoryList ];
            }
            return [];
        } );
    }
    return awPromiseSvc.instance.resolve(  [ ... _categoryList ] );
}

/**
 *
 * @param {String} uid uid
 * @returns {object} input object of category lov
 */
function getCategoryLovInput( uid ) {
    return {
        initialData:{
            filterData:{
                filterString:'',
                maxResults:0,
                numberToReturn:20,
                order:1,
                sortPropertyName:''
            },
            lov:{
                uid:'AAAAAAAAAAAAAA',
                type:'unknownType'
            },
            propertyName:'time_system_category',
            lovInput:{
                operationName:'Edit',
                boName:'UserSession',
                owningObject:{
                    uid,
                    type:'UserSession'
                },
                propertyValues:{}
            }
        }
    };
}


/**
 *@param {Object} sharedData sharedData
 * @param {Object} dataCard  dataCard
 * @param {boolean} isStandardFrequencyMode frequency mode
 */
function updateWidgetValues( sharedData, dataCard, isStandardFrequencyMode ) {
    if ( sharedData ) {
        let widgetProperty = {};
        if ( dataCard && dataCard.props ) {
            widgetProperty.uid = dataCard.uid;

            widgetProperty.quantity = parseInt( dataCard.props.Mfg0quantity.dbValues[0] );
            widgetProperty.frequency = parseFloat( dataCard.props.time_system_frequency.dbValues[0] );
            widgetProperty.category = dataCard.props.time_system_category.dbValues[0];
            if ( isStandardFrequencyMode ) {
                widgetProperty.frequencyNumerator = parseFloat( dataCard.props.time_system_frequency.dbValues[0] );
            }else{
                widgetProperty.frequencyNumerator = dataCard.props.ept0repeats.dbValues[0];
                widgetProperty.frequencyDenominator = dataCard.props.ept0perCycle.dbValues[0];
            }
        }
        sharedData.update( widgetProperty );
    }
}

export default {
    getCategoryList,
    updateWidgetValues
};
