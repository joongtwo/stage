// Copyright (c) 2022 Siemens

/**
 * @module js/epValidateEffectivityService
 */

import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import localeService from 'js/localeService';
import { constants as _epBvrConstants } from 'js/epBvrConstants';
import messagingService from 'js/messagingService';
import popupService from 'js/popupService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import epEffectivityContainer from 'js/epEffectivityContainer';
import { constants as _epEffectivityConstants } from 'js/epEffectivityConstants';
import epSaveEffectivitySvc from 'js/epSaveEffectivityService';
import _ from 'lodash';
import $ from 'jquery';
import AwPromiseService from 'js/awPromiseService';

let selectedEndItem = null;
let endItemList = {};
let endItemListForPopup = [];
let endItemToObjData = {};
let noEffectivitiesSetObj = [];
let upRangeMaxVal = 888888;
let svgns = 'http://www.w3.org/2000/svg';
let BOX_SHADOW = 'boxShadow';
let LEFT_SHADOW = '10px 0 10px -10px rgba(0, 0, 0, 0.3) inset';
let RIGHT_SHADOW = '-10px 0 10px -10px rgba(0, 0, 0, 0.3) inset';
let SCROLL = 'scroll';
let HEIGHT = 'height';
let WIDTH = 'width';
let FILL = 'fill';
let SVG = 'svg';
let RECT = 'rect';

/**
 * 
 * @param {Array} selectedObjects selected objects
 * @param {String} loadType load type
 * @returns {Object} effectivity data
 */
export function initializeValidateEffectivityPopup( selectedObjects, loadType ) {
    let deferred = AwPromiseService.instance.defer();
    const policyId = registerPolicy();
    loadPopupData( selectedObjects, loadType, [ _epBvrConstants.BL_OCC_EFFECTIVITY_PROP_NAME ] ).then( ( result ) => {
        propertyPolicySvc.unregister( policyId );
        deferred.resolve( result );
    } );
    return deferred.promise;
}

/**
 * Function accepts loadTypeInputs for creating inputs data for SOA call
 *
 * @param {Array} selectedObjects selected objects
 * @param {String} loadType the load type
 * @param {array} propertiesToLoad the props to load
 * @param {string} targetUid the target uid
 * @param {array} additionalLoadParams additional params
 *
 * @returns {Object} data for table
 */
function loadPopupData( selectedObjects, loadType, propertiesToLoad, targetUid, additionalLoadParams ) {
    let loadTypeInput = [];
    selectedObjects.forEach( obj => {
        const loadTypeforObj = epLoadInputHelper.getLoadTypeInputs( [ loadType ], obj.uid, propertiesToLoad, targetUid, additionalLoadParams );
        loadTypeInput.push( loadTypeforObj[0] );
    } );

    return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
        return createEndItemData( selectedObjects, response.ServiceData.modelObjects );
    } );
}
function showNoUnitEffectivityAppliedErrorMsg() {
    const resource = localeService.getLoadedText( 'InstructionsEffectivityMessages' );
    messagingService.showError( resource.noUnitEffectivityAppliedErrorMessage );
}
/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerPolicy() {
    let effectivityLoadPolicy = {
        types: [ {
            name: _epBvrConstants.MFG_BVR_PROCESS,
            properties: [ {
                name: _epBvrConstants.BL_OCC_EFFECTIVITY_PROP_NAME,
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: _epBvrConstants.MFG_BVR_OPERATION,
            properties: [ {
                name: _epBvrConstants.BL_OCC_EFFECTIVITY_PROP_NAME,
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: _epEffectivityConstants.EFFECTIVITY,
            properties: [ {
                name: _epEffectivityConstants.EFFECTIVITY_UNITS
            },
            {
                name: _epEffectivityConstants.END_ITEM
            }
            ]
        }
        ]
    };
    return propertyPolicySvc.register( effectivityLoadPolicy );
}

//get selected operations and create maps for end item
function createEndItemData( selectedObjects, modelObjects ) {
    _.forEach( selectedObjects, function( object ) {
        object = modelObjects[object.uid];
        setEndItemToObjDataMap( object );
    } );

    //Sort End Item to Obj Data According to Effectivity Start Range
    _.forEach( endItemToObjData, function( endItemData, currentEndItem ) {
        endItemData = _.sortBy( endItemData, function( objectData ) {
            let minRange = _.minBy( objectData.effectivityUnitRanges, function( effectivityUnitRange ) {
                return effectivityUnitRange.start;
            } );
            return minRange.start;
        } );
        endItemToObjData[currentEndItem] = endItemData;
    } );

    updatePerEndItemData();

    appendAlwaysEffectiveObjects();

    //create endItem list for popup
    _.forEach( endItemList, function( endItem ) {
        endItemListForPopup.push( {
            propInternalValue: endItem.propInternalValue,
            propDisplayValue: endItem.propDisplayValue,
            isEditable: false
        } );
    } );
    if ( endItemListForPopup.length > 0 ) {
        selectedEndItem = endItemListForPopup[0].propInternalValue;
        return {
            endItemList: endItemListForPopup,
            endItemToObjData: endItemToObjData,
            upRangeMaxVal:upRangeMaxVal
        };
    }
    clearData();
    showNoUnitEffectivityAppliedErrorMsg();
    return false;
}

function setEndItemToObjDataMap( object ) {
    if ( object && object.props.bl_occ_effectivity && object.props.bl_occ_effectivity.dbValues ) {
        if ( object.props.bl_occ_effectivity.dbValues.length > 0 ) {
            let effectivityObjs = object.props.bl_occ_effectivity.dbValues;
            _.forEach( effectivityObjs, function( effectivityObjUid ) {
                let effectivityObj = cdm.getObject( effectivityObjUid );
                let effectivityUnit = effectivityObj.props.effectivity_units.dbValues;
                let endItem = effectivityObj.props.end_item.dbValues;
                if ( endItem.length > 0 ) {
                    let effectivityUnitRanges = [];
                    let isUpRange = false;

                    for ( let count = 0; count < effectivityUnit.length; count += 2 ) {
                        let endRange;
                        if ( !effectivityUnit[count + 1] || effectivityUnit[count + 1] === '2147483647' ) {
                            endRange = upRangeMaxVal;
                            isUpRange = true;
                        } else {
                            endRange = effectivityUnit[count + 1];
                        }
                        effectivityUnitRanges.push( {
                            start: parseInt( effectivityUnit[count] ),
                            end: parseInt( endRange )
                        } );
                    }

                    if ( !endItemToObjData[endItem[0]] ) {
                        endItemToObjData[endItem[0]] = [];
                    }

                    let foundNdx = _.findIndex( endItemToObjData[endItem[0]],
                        function( obj ) { return obj.object === object; } );
                    if ( foundNdx === -1 ) {
                        endItemToObjData[endItem[0]].push( {
                            object: object,
                            effectivityUnitRanges: effectivityUnitRanges,
                            effectivityObj: effectivityObj,
                            isUp: isUpRange
                        } );
                    } else {
                        for ( let i = 0; i < endItemToObjData[endItem[0]].length; ++i ) {
                            let oldObject = endItemToObjData[endItem[0]][i].object;
                            if ( oldObject.uid === object.uid ) {
                                endItemToObjData[endItem[0]][i] = {
                                    object: object,
                                    effectivityUnitRanges: effectivityUnitRanges,
                                    effectivityObj: effectivityObj,
                                    isUp: isUpRange
                                };
                                break;
                            }
                        }
                    }
                    endItemList[endItem[0]] = {
                        propInternalValue: endItem[0],
                        propDisplayValue: effectivityObj.props.end_item.uiValues[0]
                    };
                }
            } );
        } else if ( object.props.bl_occ_effectivity.dbValues.length === 0 ) {
            noEffectivitiesSetObj.push( object );
        }
    }
}

function updatePerEndItemData() {
    _.forEach( endItemToObjData, function( endItemData, currentEndItem ) {
        let units = [];
        let validObjects = [];
        _.forEach( endItemData, function( obj ) {
            _.forEach( obj.effectivityUnitRanges, function( range ) {
                units.push( _.parseInt( range.start ) );
                if ( range.end !== upRangeMaxVal ) {
                    units.push( _.parseInt( range.end ) );
                }
            } );
            validObjects.push( obj.object );
        } );
        const minStartUnit = Math.min.apply( Math, units );
        const maxEndUnit = Math.max.apply( Math, units );
        endItemToObjData[currentEndItem].minStartUnit = minStartUnit;
        endItemToObjData[currentEndItem].maxEndUnit = maxEndUnit;
        endItemToObjData[currentEndItem].validObjects = validObjects.concat( noEffectivitiesSetObj );
    } );
}

function appendAlwaysEffectiveObjects() {
    _.forEach( endItemList, function( endItem ) {
        _.forEach( noEffectivitiesSetObj, function( object ) {
            let effectivityUnitRanges = [];
            let isUpRange = true;
            effectivityUnitRanges.push( {
                start: endItemToObjData[endItem.propInternalValue].minStartUnit,
                end: upRangeMaxVal
            } );
            endItemToObjData[endItem.propInternalValue].push( {
                object: object,
                effectivityUnitRanges: effectivityUnitRanges,
                isUp: isUpRange
            } );
        } );
    } );
}
// remove, always effectivie object from other end items, once updated for current end item.
// Note : we can use arr.splice method instead of _.remove, but not sure IE and firefox supports this method.
function removeUpdatedEndItemData( object ) {
    for ( let i = 0; i < noEffectivitiesSetObj.length; ++i ) {
        if ( noEffectivitiesSetObj[i].uid === object.uid ) {
            _.remove( noEffectivitiesSetObj, function( noEffObj ) {
                return noEffObj.uid === object.uid;
            } );
            _.forEach( endItemList, function( endItem ) {
                if ( endItem.propInternalValue !== selectedEndItem ) {
                    _.remove( endItemToObjData[endItem.propInternalValue], function( objData ) {
                        return objData.object.uid === object.uid;
                    } );
                    _.remove( endItemToObjData[endItem.propInternalValue].validObjects, function( validObj ) {
                        return validObj.uid === object.uid;
                    } );
                }
            } );
            break;
        }
    }
}

/**
 * 
 * @param {String} endItem end item
 * @param {Object} validateEffectivityData validate effectivity data
 * @param {Object} configData config data
 */
function endItemSelectionChange( endItem, validateEffectivityData, configData ) {
    const hasEffectivityUpdated =  epEffectivityContainer.hasEffectivityUpdated();
    if ( hasEffectivityUpdated ) {
        epSaveEffectivitySvc.handleUnsavedEffectivity( endItem, validateEffectivityData, configData, hasEffectivityUpdated ).then(
            function() {
                appCtxService.updatePartialCtx( _epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, false );
            } );
    } else {
        endItemSelectionChangeAfterConfirmation( endItem, validateEffectivityData, configData );
    }
}

/**
 * 
 * @param {String} endItem end item
 * @param {Object} validateEffectivityData validate effectivity data
 * @param {Object} configData config data
 */
function endItemSelectionChangeAfterConfirmation( endItem, validateEffectivityData, configData ) {
    if( endItem ) {
        selectedEndItem = endItem;
        epEffectivityContainer.setEndItem( selectedEndItem );
        epEffectivityContainer.refreshEffectivityContainer( validateEffectivityData.endItemToObjData[endItem], validateEffectivityData, configData );
    }
}

/**
 * 
 * @param {Object} effectivityData effectivity data
 */
function epUpdateValidateEffectivityDataAfterSave( effectivityData ) {
    _.forEach( effectivityData.updatedSelectedObjects, function( object ) {
        object = effectivityData.viewModelObjects[object.uid];
        setEndItemToObjDataMap( object );
        epEffectivityContainer.updateDirtyFlagOfRowObject( object.uid, false );
        removeUpdatedEndItemData( object );
    } );
}

/**
 * 
 * @param {Object} subPanelContext effectivity data context
 * @param {Object} validateEffectivityData validate effectivity data
 * @param {Object} configData config data
 */
function initializeEffectivityValidator( subPanelContext, validateEffectivityData, configData ) {
    updateEffectivityData( subPanelContext, 'validateEffectivityData', validateEffectivityData );
    let rowSvg = document.createElementNS( svgns, SVG );
    rowSvg.setAttributeNS( null, WIDTH, 70 );
    rowSvg.setAttributeNS( null, HEIGHT, 70 );
    let rect = document.createElementNS( svgns, RECT );
    rect.setAttributeNS( null, WIDTH, 70 );
    rect.setAttributeNS( null, HEIGHT, 70 );
    rect.setAttributeNS( null, FILL, '#005f87' );

    rowSvg.appendChild( rect );
    epEffectivityContainer.refreshEffectivityContainer(
        validateEffectivityData.endItemToObjData[validateEffectivityData.endItemList[0].propInternalValue],
        validateEffectivityData, configData
    );
    //Scroll synchronization between divisions
    $( '.aw-epInstructionsEffectivity-operationPlot' ).on( SCROLL, function() {
        $( '.aw-epInstructionsEffectivity-summaryPlot' ).scrollLeft( $( this ).scrollLeft() );
        updateShadowLines( $( this ) );
    } );

    $( '.aw-epInstructionsEffectivity-operationUpCheckbox' ).on( SCROLL, function() {
        $( '.aw-epInstructionsEffectivity-operationPlot' ).scrollTop( $( this ).scrollTop() );
        $( '.aw-epInstructionsEffectivity-operationRowName' ).scrollTop( $( this ).scrollTop() );
    } );
}

function updateShadowLines( div ) {
    if( div[0].className.includes( 'aw-epInstructionsEffectivity-hidePlotShadow' ) ) {
        return;
    }
    let boxShadow = LEFT_SHADOW + ',' + RIGHT_SHADOW;

    //Offset 2px
    let offset = 2;
    if ( div[0].scrollWidth - div.scrollLeft() - div.width() <= 2 ) {
        boxShadow = LEFT_SHADOW;
    } else if ( div.scrollLeft() <= offset ) {
        boxShadow = RIGHT_SHADOW;
    }

    div[0].style[BOX_SHADOW] = boxShadow;
}


/**
 * 
 * @param {Object} validateEffectivityPopupRef validate effectivity popup ref
 * @param {Object} endItem end item
 * @param {Object} effectivityData effectivity data
 * @param {Object} configData config data
 */
function closePopup( validateEffectivityPopupRef, endItem, effectivityData, configData ) {
    if ( epEffectivityContainer.hasEffectivityUpdated() ) {
        epSaveEffectivitySvc.handleUnsavedEffectivity( endItem, effectivityData, configData ).then(
            function() {
                appCtxService.updatePartialCtx( _epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, false );
                closePopupAfterConfirmation();
            } );
    } else {
        closePopupAfterConfirmation( validateEffectivityPopupRef );
    }
}

function closePopupAfterConfirmation( validateEffectivityPopupRef ) {
    clearData();
    popupService.hide( validateEffectivityPopupRef );
}

function clearData() {
    selectedEndItem = null;
    endItemList = {};
    endItemListForPopup = [];
    noEffectivitiesSetObj = [];
    endItemToObjData = {};
    epEffectivityContainer.destroyObject();
}

/**
 * Update atomic data for validate occurence effectivity
 * @param {Object} subPanelContext effectivity context data
 * @param {String} keyToUpdate key to update
 * @param {Object} dataToUpdate data to update
 */
function updateEffectivityData( subPanelContext, keyToUpdate, dataToUpdate ) {
    if( subPanelContext && subPanelContext.effectivityData ) {
        let effectivityDataToUpdate = { ...subPanelContext.effectivityData.getValue() };
        effectivityDataToUpdate[keyToUpdate] = dataToUpdate;
        subPanelContext.effectivityData.update( effectivityDataToUpdate );
    }
}

const exports = {
    closePopup,
    endItemSelectionChange,
    endItemSelectionChangeAfterConfirmation,
    initializeEffectivityValidator,
    initializeValidateEffectivityPopup,
    epUpdateValidateEffectivityDataAfterSave,
    updateEffectivityData
};

export default exports;
