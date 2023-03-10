// Copyright (c) 2022 Siemens

/**
 * @module js/senAssignPartsHandler
 */
import appCtxSvc from 'js/appCtxService';
import addElementService from 'js/addElementService';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';

var exports = {};

let singleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded === 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'elementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let multipleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded > 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'multipleElementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let showInfo = function( meta ) {
    localeService.getLocalizedText( meta.path, meta.key ).then( function( localizedMessage ) {
        let message = messagingService.applyMessageParams( localizedMessage, meta.params, meta.context );
        messagingService.showInfo( message );
    } );
};

var postProcessAddObject = function( inputData ) {
    var eventData = {
        objectsToSelect: addElementService.getNewlyAddedChildElements( inputData ),
        addElementResponse: inputData.addElementResponse,
        addElementInput: appCtxSvc.getCtx( 'aceActiveContext' ).context.addElementInput,
        viewToReact: 'sbomContext'
    };
    eventBus.publish( 'addElement.elementsAdded', eventData );
};

var createAddObjectInput = function( sourceObjects, context ) {
    var soaInput = {};
    soaInput.input = {};
    let aceActiveContext_ctx = appCtxSvc.getCtx( 'aceActiveContext' );
    soaInput.input.objectsToBeAdded = addElementService.getElementsToAdd( '', '', sourceObjects );
    soaInput.input.fetchPagedOccurrences = true;
    soaInput.input.parentElement = aceActiveContext_ctx.context.addElementInput.parent;
    soaInput.input.inputCtxt = {
        productContext: context.productContextInfo
    };
    soaInput.input.sortCriteria = {
        propertyName: aceActiveContext_ctx.context.sortCriteria ? aceActiveContext_ctx.context.sortCriteria[ 0 ].fieldName : undefined,
        sortingOrder: aceActiveContext_ctx.context.sortCriteria ? aceActiveContext_ctx.context.sortCriteria[ 0 ].sortDirection : undefined
    };
    soaInput.input.addObjectIntent = aceActiveContext_ctx.context.addElementInput.addObjectIntent;
    soaInput.input.requestPref = {
        displayMode: [ addElementService.getDisplayMode() ]
    };
    soaInput.input.numberOfElements = 1;
    return soaInput;
};

export let assignFromEbomToSbom = function( sourceObjects, targetObject, context ) {
    var totalObjectsAdded;
    var inputData = {};
    var addElementInput = {};
    addElementInput.parent = targetObject;
    addElementInput.addObjectIntent = 'MfgDragAndDropIntent';
    var clone = { ...appCtxSvc.getCtx( 'aceActiveContext' ) };
    clone.context.addElementInput = addElementInput;
    clone.context.isChangeEnabled = true;
    appCtxSvc.updateCtx( 'aceActiveContext', clone );

    var soaInput = createAddObjectInput( sourceObjects, context );
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'addObject3', soaInput ).then( function( response ) {
        var err;
        inputData.addElementResponse = response;
        totalObjectsAdded = addElementService.getTotalNumberOfChildrenAdded( response );
        if( totalObjectsAdded > 0 || response.ServiceData.partialErrors ) {
            if( response.ServiceData.partialErrors ) {
                err = soaSvc.createError( response.ServiceData );
                var errMessage = messagingService.getSOAErrorMessage( err );
                messagingService.showError( errMessage );
            }
            postProcessAddObject( inputData );
        }
        let msgContext = {
            totalObjectsAdded: totalObjectsAdded,
            selectedObjectString: _.get( response, 'selectedNewElementInfo.newElements[0].props.object_string.dbValues[0]' ),
            parentObjectString: _.get( targetObject, 'props.object_string.dbValues[0]' )
        };

        singleElementAddSuccessful( msgContext, [ '{{selectedObjectString}}', '{{parentObjectString}}' ] );
        multipleElementAddSuccessful( msgContext, [ '{{totalObjectsAdded}}', '{{parentObjectString}}' ] );
    } );
};

export default exports = {
    assignFromEbomToSbom
};
