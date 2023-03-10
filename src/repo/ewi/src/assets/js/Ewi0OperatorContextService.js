// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global define */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ewi0OperatorContextService
 */
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';

/**
 * Cached client data model service
 */

/**
 * Get the operators list to display
 *
 * @returns {ObjectArray} operatorsList - response LOV of operators
 */
export let generateOperatorContextList = function() {
    let operatorsList = [];

    // Create an entry for "All"
    let resource = 'EWIMessages';
    let localTextBundle = localeSvc.getLoadedText( resource );
    let allContextString = localTextBundle.all;

    // Add the 'All' entry as the first in the list
    let allContextEntry = {
        propDisplayValue: allContextString,
        propInternalValue: ''
    };
    operatorsList.push( allContextEntry );

    // Add all the Mfg0BvrProcessStation operators to the list
    let currentStep = appCtxSvc.ctx.EWI0currentStep;
    if( currentStep ) {
        let operators = currentStep.props.Mfg0processResources;
        if( operators ) {
            let operatorsNames = operators.uiValues;
            let operatorsUids = operators.dbValues;
            for( let operatorIndx in operatorsNames ) {
                let operatorObj = cdm.getObject( operatorsUids[ operatorIndx ] );
                if( operatorObj && operatorObj.props.bl_item_item_id && operatorObj.props.object_string ) {
                    let currOperator = {
                        propDisplayValue: operatorObj.props.object_string.dbValues[ 0 ],
                        propInternalValue: operatorObj.props.bl_item_item_id.uiValues[ 0 ]
                    };
                    operatorsList.push( currOperator );
                }
            }
        }
    }
    return {
        operatorsList: operatorsList
    };
};

/**
 * Update the selected operator in the comboBox
 *
 * @param {Object} operatorData - the current selected operator object
 * @param {ObjectArray} operatorsList - the operators list combo
 */
export let setSelectedOperator = function( operatorData, operatorsList ) {
    const currOperatorItemId = AwStateService.instance.params.resource;
    if( currOperatorItemId || currOperatorItemId === '' ) {
        let currSelected = operatorData.dbValue;
        let currSelectedItemId = '';
        if( currSelected !== '' ) {
            currSelectedItemId = currSelected;
        }
        if( currOperatorItemId !== currSelectedItemId || operatorData.propertyDisplayName === '' ) {
            let operatorName = '';
            for( let operatorIndx in operatorsList ) {
                if( operatorsList[ operatorIndx ].propInternalValue === currOperatorItemId ) {
                    operatorName = operatorsList[ operatorIndx ].propDisplayValue;
                    break;
                }
            }

            operatorData.dbValue = {
                propInternalValue: currOperatorItemId,
                propDisplayValue: operatorName
            };
            operatorData.propertyDisplayName = operatorName;
        }
    }
};

/**
 * Change context according to the current value of ewi0GlobalOperatorContext by adding the operator uid as a
 * resource parameter to the URL address
 *
 * @param {Object} operatorData - the current selected operator object
 * @param {Object} operatorItemId - the selected operator item id
 * @param {ObjectArray} operatorsList - the operators list combo
 */
export let setOperatorContext = function( operatorData, operatorItemId, operatorsList ) {
    const stateParams = AwStateService.instance.params;

    if( stateParams.resource !== operatorItemId ) {
        let newParams = {
            resource: operatorItemId,
            page: 'EWI'
        };

        AwStateService.instance.go( '.', newParams );
        // Update the screen
        eventBus.publish( 'ewi.loadStep' );
    } else {
        setSelectedOperator( operatorData, operatorsList );
    }
};

export default {
    generateOperatorContextList,
    setSelectedOperator,
    setOperatorContext
};
/**
 * @member Ewi0OperatorContextService
 * @memberof NgServices
 *
 * @param {Object} appCtxSvc - appCtxService
 * @param {Object} localeSvc - locale service
 * @param {Object} $state - $state
 * @param {Object} cdm - soa_kernel_clientDataModel
 *
 * @return {Object} - Service instance
 */
