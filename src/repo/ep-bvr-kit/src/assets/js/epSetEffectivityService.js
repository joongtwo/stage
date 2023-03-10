// Copyright (c) 2022 Siemens

/**
 * Service for ep effectivity.
 *
 * @module js/epSetEffectivityService
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import popupService from 'js/popupService';
import localeSvc from 'js/localeService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';

const instrMessagePath = '/i18n/InstructionsEffectivityMessages';

/**
 * loads all unit effectivities of selected operation/process
 * @param {Object} selectedObj - selected object in ep editor
 */
export function loadEffectivities( selectedObject ) {
    let effectivityObjs = [];

    const effectivityInfoloadInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.EFFECTIVITY_INFO,
        selectedObject[0].uid );
    return epLoadService.loadObject( effectivityInfoloadInputs, false ).then( function( output ) {
        if( output.relatedObjectsMap && output.relatedObjectsMap[ selectedObject[0].uid ] ) {
            effectivityObjs = output.relatedObjectsMap[ selectedObject[0].uid ].additionalPropertiesMap2.Effectivity.map( ( effectivityObjUid ) => {
                return output.ServiceData.modelObjects[ effectivityObjUid ];
            } );
        }
        return {
            effectivityObjs: effectivityObjs,
            selectedObject: selectedObject
        };
    } );
}

/**
 * updates the dataProvider with updated effectivity list
 * @param {Array} effectivityObjs : effectivity objects list
 * @param {Array} removedEffectivityObjs - effectivity objects
 * @param {Object} dataProvider dataProvider
 */
export function updateEffectivityList( effectivityObjs, removedEffectivityObjs, dataProvider ) {
    const index = effectivityObjs.findIndex( effObj => effObj.uid === removedEffectivityObjs[ 0 ].uid );
    if( index >= 0 ) {
        effectivityObjs.splice( index, 1 );
        dataProvider.update( effectivityObjs, effectivityObjs.length );
    }
}
/**
 * function to set a value in occContext
 * @param {Object} occContext : occContext
 * @param {Array} value : selected object

 */
export function initOccContext( occContext, uid ) {
    const loadType = [ 'GetAwbElements' ];
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( loadType, uid );
    return epLoadService.loadObject( loadTypeInputs, false ).then(
        function( response ) {
            if( response.relatedObjectsMap ) {
                const selectedModelObjectsUid = response.relatedObjectsMap[ uid ].additionalPropertiesMap2.mbc0awbElement[ 0 ];
                const elementtoSelect = [ response.ServiceData.modelObjects[ selectedModelObjectsUid ] ];

                if( occContext && uid && typeof occContext === 'object' ) {
                    occContext.update( { ...occContext.getValue(), selectedModelObjects: elementtoSelect } );
                }
            }
        } );
}

function closeSetEffectivityPanel( panelId ) {
    let commandId = appCtxService.getCtx( 'sidenavCommandId' );
    appCtxService.unRegisterCtx( 'activeToolsAndInfoCommand' );
    if( commandId ) {
        eventBus.publish( 'awsidenav.openClose', {
            id: panelId,
            commandId: commandId
        } );
    }
}
/**
 * loads all unit effectivities of selected Product View object
 * @param {Object} selectedProductView - selected object in Visuals section
 * @param {Object} scopeForSelectedObject - scope for selected object if any
 */
export function loadProductViewEffectivities( selectedProductView, scopeForSelectedObject ) {
    let effectivityObjs = [];
    let selectedObject;

    if( typeof selectedProductView === 'object' ) {
        selectedObject = selectedProductView;
    } else {
        let parsedSelectedObj = JSON.parse( selectedProductView );
        if( parsedSelectedObj && Array.isArray( parsedSelectedObj ) ) {
            selectedObject = parsedSelectedObj[ 0 ];
        }
    }
    if( selectedProductView.effectivities ) {
        effectivityObjs = selectedProductView.effectivities;
    }

    return {
        effectivityObjs: effectivityObjs,
        selectedObject: selectedObject,
        scopeForSelectedObject: scopeForSelectedObject
    };
}

/**
 * This function returns empty effectivity object
 * @returns{object} empty obj
 */
export function clearPrevEffectivityObj( data ) {
    return {};
}

/**
 * Auto-revise check
* @param {*} selectedScope - scope for the selected object
 */
export function performAutoReviseCheck( selectedScope ) {
    let autoReviseCheckDone = true;
    let object = selectedScope;
    let saveInputWriter = saveInputWriterService.get();
    if ( object ) {
        saveInputWriter.addReviseInput( object );
        return epSaveService.saveChanges( saveInputWriter, true, [ object ] )
            .then( function( result ) {
                if ( !result ) {
                    autoReviseCheckDone = false;
                }
                return autoReviseCheckDone;
            } );
    }
}

let exports;
export default exports = {
    loadEffectivities,
    updateEffectivityList,
    initOccContext,
    clearPrevEffectivityObj,
    performAutoReviseCheck,
    closeSetEffectivityPanel
};
