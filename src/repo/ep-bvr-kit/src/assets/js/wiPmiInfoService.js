// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import epPropCacheSvc from 'js/epObjectPropertyCacheService';
import cdm from 'soa/kernel/clientDataModel';
import wiPMIConstants from 'js/wiPMIConstants';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import vmoSvc from 'js/viewModelObjectService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import dms from 'soa/dataManagementService';
import popupService from 'js/popupService';
import _ from 'lodash';
import localeSvc from 'js/localeService';
import mfeFilterAndSortSvc from 'js/mfeFilterAndSortService';
import eventBus from 'js/eventBus';
import propPolicySvc from 'soa/kernel/propertyPolicyService';


let infoPopupRef;
const localizedMsgs = localeSvc.getLoadedText( 'wiPmiMessages' );
const pmiPropPolicy = {
    types: [ {
        name: wiPMIConstants.MCI_PMI_CHARACTERISTIC,
        properties: [ {
            name: wiPMIConstants.MCI_DATUM_LABEL
        } ]
    } ]
};

const pipe = ( ...fns ) => ( ...args ) => fns.slice( 1 ).reduce( ( acc, fn ) => fn( acc ), fns[0]( ...args ) );
const getPropertyOfObject = ( obj, propString ) => propString.split( '.' ).reduce( ( acc, prop ) => acc ? acc[prop] : undefined, obj );
const getEmptyArrayForNonArrayObj = ( arr ) => Array.isArray( arr ) ? arr : [];
const addObjStringOfUidAsPropToVmo = ( objUid, vmo, propertyName ) => addStringPropToVmo(
    getPropertyOfObject(
        cdm.getObject( objUid ),
        'props.object_string.dbValues.0'
    ),
    vmo,
    propertyName
);

/**
 * WI PMI service
 *
 * @module js/wiPmiInfoService
 */


/**
 * @param {ViewModelObject} vmo - a ViewModelObject
 * @param {string} currentScopeUid - uid of current Scope
 * @param {string} currentAssyUid - uid of current Assembly
 * @return {promise} a promise object
 */
function getPMIDetails( vmo, currentScopeUid, currentAssyUid ) {
    if( mfeTypeUtils.isOfType( vmo, wiPMIConstants.MCI_INSPECTION_REVISION ) ) {
        return dms.getProperties( [ vmo.uid ], [ wiPMIConstants.MCI_CHARACTERISTIC_OF_INSPECTION ] ).then(
            () => {
                const characteristicUid = vmo.props[wiPMIConstants.MCI_CHARACTERISTIC_OF_INSPECTION].dbValues[0];
                return loadPmiDetails( characteristicUid, currentScopeUid, currentAssyUid );
            }
        );
    }
    return loadPmiDetails( vmo.uid, currentScopeUid, currentAssyUid );
}

/**
 * @param {string} characteristicUid - characteristic pmi object uid
 * @param {string} currentScopeUid - uid of current Scope
 * @param {string} currentAssyUid - uid of current Assembly
 * @return {promise} a promise object
 */
function loadPmiDetails( characteristicUid, currentScopeUid, currentAssyUid ) {
    if( characteristicUid ) {
        const additionalParam = [ {
            tagName: 'contextData',
            attributeName: 'context',
            attributeValue: [ currentScopeUid, currentAssyUid ]
        } ];

        const pmiObjectPolicyId = propPolicySvc.register( pmiPropPolicy );

        const loadInputTypes = epLoadInputHelper.getLoadTypeInputs( [ 'PMI_Details' ], characteristicUid, [], '', additionalParam );
        return epLoadService.loadObject( loadInputTypes, false ).then( () => {
            const connectedParts = createModelObjWithTargetAssyAndProcess(
                epPropCacheSvc.getProperty( characteristicUid, wiPMIConstants.PMI_CONNECTED_PARTS_PSEUDO_PROP ).map( uid => cdm.getObject( uid ) )
            );
            const referencedDatums = pipe(
                mfeFilterAndSortSvc.sortModelObjectsByProp
            )( epPropCacheSvc.getProperty( characteristicUid, wiPMIConstants.PMI_REFERENCED_DATUMS_PSEUDO_PROP ).map( uid => cdm.getObject( uid ) ), wiPMIConstants.MCI_DATUM_LABEL, true );

            propPolicySvc.unregister( pmiObjectPolicyId );

            return {
                connectedParts,
                referencedDatums
            };
        } );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}


/**
 *
 * @param {string} partUid part uid to updated
 * @param {ViewModelObject[]} vmos vmos to update
 * @param {Number} updateFromIndex vmos start index
 * @param {string} loadedAssyUid loaded assembly uid
 * @param {string} loadedProcessUid loaded process uid
 * @returns {Number} updated vmo count
 */
 function updateVmosTargetAssyForPart( partUid, vmos, updateFromIndex, loadedAssyUid, loadedProcessUid ) {
    const targetAssyList = pipe(
        epPropCacheSvc.getProperty,
        getEmptyArrayForNonArrayObj
    )( partUid, wiPMIConstants.PMI_TARGET_ASSEMBLY );

    // current loaded should listed first
    const indexOfLoadedAssyUid = targetAssyList.indexOf( loadedAssyUid );
    if( indexOfLoadedAssyUid > -1 ) {
        const tempStorage = targetAssyList[ indexOfLoadedAssyUid ];
        targetAssyList[ indexOfLoadedAssyUid ] = targetAssyList[ 0 ];
        targetAssyList[ 0 ] = tempStorage;
    }

    let updatedVmoCount = 0;
    targetAssyList.forEach( assyUid => {
        if( assyUid === loadedAssyUid ) {
            addStringPropToVmo( localizedMsgs.currentLoadedAssembly, vmos[ updateFromIndex + updatedVmoCount ], wiPMIConstants.PMI_TARGET_ASSEMBLY_PROP );
        } else {
            addObjStringOfUidAsPropToVmo( assyUid, vmos[ updateFromIndex + updatedVmoCount ], wiPMIConstants.PMI_TARGET_ASSEMBLY_PROP );
        }
        updatedVmoCount += updateVmosTargetProcessOfAssy( assyUid, vmos, updateFromIndex + updatedVmoCount, loadedProcessUid );
    } );

    return updatedVmoCount ? updatedVmoCount : 1;
}

/**
 *
 * @param {string} assyUid assembly uid to be updated
 * @param {ViewModelObject[]} vmos vmo to update
 * @param {Number} updateFromIndex vmos start index
 * @param {String} loadedProcessUid loaded process uid
 * @returns {Number} updated vmo count
 */
function updateVmosTargetProcessOfAssy( assyUid, vmos, updateFromIndex, loadedProcessUid ) {
    const targetProcessList = pipe(
        epPropCacheSvc.getProperty,
        getEmptyArrayForNonArrayObj
    )( assyUid, wiPMIConstants.PMI_TARGET_PROCESS );

    // current loaded should listed first
    const indexOfLoadedProcessUid = targetProcessList.indexOf( loadedProcessUid );
    if( indexOfLoadedProcessUid > -1 ) {
        const tempStorage = targetProcessList[ indexOfLoadedProcessUid ];
        targetProcessList[ indexOfLoadedProcessUid ] = targetProcessList[ 0 ];
        targetProcessList[ 0 ] = tempStorage;
    }

    let updatedVmoCount = 0;
    targetProcessList.forEach( processUid => {
        if( processUid === loadedProcessUid ) {
            addStringPropToVmo( localizedMsgs.currentLoadedProcess, vmos[updateFromIndex + updatedVmoCount], wiPMIConstants.PMI_TARGET_PROCESS_PROP );
        } else {
            addObjStringOfUidAsPropToVmo( processUid, vmos[updateFromIndex + updatedVmoCount], wiPMIConstants.PMI_TARGET_PROCESS_PROP );
        }
        updatedVmoCount++;
    } );

    return updatedVmoCount;
}

/**
 *
 * @param {string} propertyValue displayValue of property
 * @param {ViewModelObject} vmo vmo to update
 * @param {string} propertyName new property name to be added to vmo
 */
function addStringPropToVmo( propertyValue, vmo, propertyName ) {
    const displayValue = [ propertyValue ];
    const value = displayValue;
    const prop = {
        value,
        displayValue,
        propType: 'STRING',
        isArray: false
    };
    vmo.props[ propertyName ] = vmoSvc.constructViewModelProperty( prop, propertyName, vmo, false );
}


/**
 *
 * @param {modelObject[]} modelObjects - modelObject List
 * @returns {Object[]} modelObject List with psuedo rows
 */
function createModelObjWithTargetAssyAndProcess( modelObjects ) {
    const modelObjectsWithTargetAssyAndProcess = [];
    modelObjects.forEach( ( modelObj ) => {
        modelObjectsWithTargetAssyAndProcess.push( modelObj );

        // add psuedo rows
        const assyUids = epPropCacheSvc.getProperty( modelObj.uid, wiPMIConstants.PMI_TARGET_ASSEMBLY );
        if ( Array.isArray( assyUids ) && assyUids.length > 0 ) {
            const psuedoRowCount = assyUids.reduce( ( accumulator, assyUid ) => accumulator + epPropCacheSvc.getProperty( assyUid, wiPMIConstants.PMI_TARGET_PROCESS ).length, -1 );
            for( let i = 0; i < psuedoRowCount; i++ ) {
                modelObjectsWithTargetAssyAndProcess.push( { uid:null, props: {} } );
            }
        }
    } );

    return modelObjectsWithTargetAssyAndProcess;
}


/**
 * @param {ViewModelObject[]} referencedDatumVmos - the loaded connected parts VMOs
 */
function updateReferencedDatumVmo( referencedDatumVmos ) {
    if( referencedDatumVmos ) {
        referencedDatumVmos.forEach( ( referencedDatumVmo ) => {
            let displayValue = [ localizedMsgs.datumNotPointingToPart ];
            let value = displayValue;
            const partUids = epPropCacheSvc.getProperty( referencedDatumVmo.uid, wiPMIConstants.PMI_CONNECTED_PARTS_PSEUDO_PROP );
            if( Array.isArray( partUids ) && partUids.length > 0 ) {
                displayValue = '';
                partUids.forEach( ( partUid ) => {
                    const modelObject = cdm.getObject( partUid );
                    displayValue = `${displayValue}${modelObject.props.object_string.dbValues[0]} , `;
                } );
                displayValue = [ displayValue.slice( 0, -3 ) ];
                value = partUids;
            }
            const connectedPartsProp = {
                value,
                displayValue,
                propType: 'STRING',
                isArray: false
            };
            referencedDatumVmo.props.connectedParts = vmoSvc.constructViewModelProperty( connectedPartsProp, 'connectedParts', referencedDatumVmo, false );
        } );
    }
}

/**
 *
 * @param {ViewModelObject[]} connectedPartVmos connected part vmos
 * @param {string} loadedAssyUid loaded assembly uid
 * @param {string} loadedProcessUid loaded process uid
 */
function updateConnectedPartVmos( connectedPartVmos, loadedAssyUid, loadedProcessUid ) {
    if( connectedPartVmos ) {
        let i = 0;
        while( i < connectedPartVmos.length ) {
            i += connectedPartVmos[ i ].uid ? updateVmosTargetAssyForPart( connectedPartVmos[ i ].uid, connectedPartVmos, i, loadedAssyUid, loadedProcessUid ) : 1;
        }
    }
}

/**
 * responsible for showing the information popup of the pmi
 *
 * @param {String} popupTitle - the popup title
 * @param {Object} pmiContextObject - the popup pmi context object
 */
function showPmiInformationPopup( popupTitle, pmiContextObject ) {
    // handles the case when opening a popup without closing an already opened one
    if( infoPopupRef ) {
        closePmiInformationPopup();
    }
    const popupData = {
        declView: 'WiPmiInformation',
        locals: {
            anchor: 'mfeDisabledCloseModalPopupCommandAnchor',
            caption: popupTitle
        },
        options: {
            reference: 'button[button-id=\'pmiMoreCommand\']',
            detachMode: true,
            height: 420,
            width: 700,
            clickOutsideToClose: false,
            draggable: true,
            isModal: false,
            placement: 'bottom-start',
            disableClose: true,
            flipBehavior: 'counterclockwise'
        },
        subPanelContext: pmiContextObject
    };
    popupService.show( popupData ).then( ( currentPopupRef ) => {
        infoPopupRef = currentPopupRef;
        eventBus.publish( 'pmiDetailedCommandclicked', {
            pmiVmo: pmiContextObject
        } );
    } );
}

/**
 * responsible for closing the information popup of the pmi
 */
function closePmiInformationPopup() {
    if( infoPopupRef && infoPopupRef.options ) {
        infoPopupRef.options.disableClose = false;
    }
    popupService.hide( infoPopupRef );
    infoPopupRef = undefined;
}

/**
 * responsible for closing the information popup of the pmi when unassigning the current inspection pmi
 *
 * @param {String} inspectionsRemoved - the array of inspections which were unassigned
 * @param {Object} pmiInformationPopupObj - the popup pmi context object
 */
function closeInformationPopupAfterUnassigningInspectionPmi( inspectionsRemoved, pmiInformationPopupObj ) {
    if( inspectionsRemoved && inspectionsRemoved.length > 0 ) {
        if ( _.find( inspectionsRemoved, ( removedInspection ) => removedInspection === pmiInformationPopupObj.uid ) ) {
            closePmiInformationPopup();
        }
    }
}

/**
 *
 * @param {ViewModelObject} vmo - loaded viewModel object
 * @returns {Object} definedIn property
 */
function getWhereDefinedInfo( vmo ) {
    const contextUids = epPropCacheSvc.getProperty( vmo.uid, wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP );
    const contextModelObj = cdm.getObject( contextUids[ 0 ] );
    return {
        uid: epPropCacheSvc.getProperty( vmo.uid, wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP )[ 0 ],
        propertyDisplayName: contextModelObj.props.object_string.dbValues[0]
    };
}

export default{
    getPMIDetails,
    showPmiInformationPopup,
    updateReferencedDatumVmo,
    closePmiInformationPopup,
    closeInformationPopupAfterUnassigningInspectionPmi,
    getWhereDefinedInfo,
    updateConnectedPartVmos
};
