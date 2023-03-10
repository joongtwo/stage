// Copyright (c) 2022 Siemens

/**
 * Service for Background Parts
 *
 * @module js/epBackgroundPartService
 */
import { constants as epSaveConstants } from 'js/epSaveConstants';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import epBackgroundPartsToEBOMCacheService from 'js/epBackgroundPartsToEBOMCacheService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';

const SET_SELECTION_IN_EBOM_TREE_EVENT_NAME = 'ep.setSelectionInMBOMTree';
/**
 * This will make Save call for Assigning Parts to Background Parts collector.
 * @param { Object } targetObject - To which object given parts should get assigned as Background Part.
 * @param { ObjectArray } partsToAssign - Part Objects to assign.
 */
function assignBackgroundParts( targetObject, partsToAssign ) {
    if( targetObject.uid && partsToAssign[ 0 ] ) {
        assignOrRemoveBackgroundParts( targetObject, partsToAssign );
    }
}

/**
 * This will make Save call for removing Parts from Background Parts collector.
 * @param { Object } targetObject - From which given Background parts should get removed.
 * @param { ObjectArray } partsToRemove - Part Objects to remove.
 */
function removeBackgroundParts( targetObject, partsToRemove ) {
    if( targetObject.uid && partsToRemove[ 0 ] ) {
        assignOrRemoveBackgroundParts( targetObject, [], partsToRemove );
    }
}

/**
 * This will remove/assign Background Parts
 *
 * @param { Object } targetObject - To which object given parts should get assigned/removed.
 * @param { ObjectArray } partsToAssign - Part Objects to assign.
 * @param { ObjectArray } partsToRemove - Part Objects to remove.
 */
function assignOrRemoveBackgroundParts( targetObject, partsToAssign, partsToRemove ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];
    let partsToAssignUid = [];
    let partsToRemoveUid = [];
    let saveAddOrRemoveInput = {
        relationType: [ '' ],
        AssignmentMode: [ epSaveConstants.BACKGROUND_PART_ASSIGNMENT_MODE ],
        useDefaultRelationType: 'true'
    };

    relatedObject.push( targetObject );

    let isRootObjectSelectedForAssignment = false;
    partsToAssign && partsToAssign.forEach( ( part ) => {
        if( part.uid === appCtxService.ctx.epPageContext.ebomStructure.uid ) {
            isRootObjectSelectedForAssignment = true;
        } else {
            partsToAssignUid.push( part.uid );
            relatedObject.push( part );
        }
    } );

    if( isRootObjectSelectedForAssignment ) {
        const resource = localeService.getLoadedText( 'BackgroundPartsMessages' );
        let buttonArray = [];
        buttonArray.push( mfgNotificationUtils.createButton( resource.close, function( callBack ) {
            callBack.close();
        } ) );
        messagingService.showError( resource.cannotAssignBackgroundPart.format( appCtxService.ctx.epPageContext.ebomStructure.props.object_string.dbValues[ 0 ] ), null, null, buttonArray );
        return;
    }

    partsToRemove && partsToRemove.forEach( ( part ) => {
        partsToRemoveUid.push( part.uid );
        relatedObject.push( part );
    } );

    if( partsToAssignUid.length > 0 ) {
        saveAddOrRemoveInput.Add = partsToAssignUid;
    } else if( partsToRemoveUid.length > 0 ) {
        saveAddOrRemoveInput.Remove = partsToRemoveUid;
    }

    saveInputWriter.addRelatedObjects( relatedObject );
    saveInputWriter.addAssignedParts( {
        id: targetObject.uid
    }, saveAddOrRemoveInput );

    epSaveService.saveChanges( saveInputWriter, true, relatedObject );
}
/**
 *
 * @param {Object} vmo vmo
 * @returns {Promise} promise
 */
function showMatchingEBOMLine( vmo ) {
    let matchingEBOMLineUid = epBackgroundPartsToEBOMCacheService.getmatchingEBOMLine( vmo.uid );
    if( !matchingEBOMLineUid ) {
        return getEBOMLineFromServer( vmo );
    }
    eventBus.publish( SET_SELECTION_IN_EBOM_TREE_EVENT_NAME, { selectionObject: cdm.getObject( matchingEBOMLineUid ) } );
    return AwPromiseService.instance.resolve( null );
}

/**
 *
 * @param {VMO} object object
 * @returns {Array} addLoadParams
 */
function getLoadParams( object ) {
    return [ {
        tagName: 'searchType',
        attributeName: 'type',
        attributeValue: ''
    },
    {
        tagName: 'nodesToFind',
        attributeName: 'objectUid',
        attributeValue: object.uid
    },
    {
        tagName: 'contextObject',
        attributeName: 'objectUid',
        attributeValue: appCtxService.getCtx( 'epPageContext.ebomStructure.uid' )
    }
    ];
}
/**
 *
 * @param {VMO} object backgroun part
 */
function getEBOMLineFromServer( object ) {
    const addLoadParams = getLoadParams( object );
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.FIND_NODE_IN_CONTEXT, '', '', '', addLoadParams );
    return epLoadService.loadObject( loadTypeInputs, false ).then( function( result ) {
        const matchingEBOMLineUid = result.relatedObjectsMap[ object.uid ].additionalPropertiesMap2.foundNodes[ 0 ];
        const matchingEBOMLine = cdm.getObject( matchingEBOMLineUid );
        eventBus.publish( SET_SELECTION_IN_EBOM_TREE_EVENT_NAME, { selectionObject: [ matchingEBOMLine ] } );
        //update cache
        epBackgroundPartsToEBOMCacheService.setmatchingEBOMLine( object.uid, matchingEBOMLineUid );
    } );
}

/**
 *
 * @returns{Object} additionalLoadParams
 */
function getLoadParamsForAssociatedAssembly() {
    return [ {
        tagName: 'expandType',
        attributeName: 'type',
        attributeValue: 'ExpandMBOMDetailedPlanning'
    },
    {
        tagName: 'expandInfo',
        attributeName: 'level',
        attributeValue: 'TOP'
    },
    {
        tagName: 'expandInfo',
        attributeName: 'rootsProperty',
        attributeValue: 'associatedAssembly'
    }
    ];
}
/**
 *
 * @param {string} bop uid
 * @returns{promise} promise
 */
function loadAssociatedAssembly( bop ) {
    const additionalLoadParams = getLoadParamsForAssociatedAssembly( );
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( 'CommonExpand', bop, '', '', additionalLoadParams );
    return epLoadService.loadObject( loadTypeInput, false );
}

export default  {
    assignBackgroundParts,
    removeBackgroundParts,
    showMatchingEBOMLine,
    loadAssociatedAssembly
};
