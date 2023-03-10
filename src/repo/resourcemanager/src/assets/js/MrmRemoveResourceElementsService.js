// Copyright (c) 2022 Siemens

/**
 * Creates an array of uids and types for the removed element after "removeResourceElements" soa call.
 *
 * @module js/MrmRemoveResourceElementsService
 */
import appCtxSvc from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * It performs remove post action after removed single element
 *
 * @param {Object} removedElement - the removed element.
 */
export let performPostSingleRemoveAction = function( removedElement ) {
    var removedObjects = [];
    removedObjects.push( removedElement );

    //Get underlying object and store them in clipboard
    var contextObj = removedObjects.filter( function( obj ) {
        return cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[0] ) !== null;
    } ).map( function( obj ) {
        return obj.props.awb0UnderlyingObject.dbValues[0];
    } );

    if ( contextObj.length > 0 ) {
        ClipboardService.instance.setContents( contextObj );
    }

    //Deselect removed elements from selection model
    eventBus.publish( 'aceElementsDeSelectedEvent', {
        elementsToDeselect: removedObjects
    } );

    if ( removedObjects.length > 0 ) {
        //publish elements removed from PWA
        eventBus.publish( 'ace.elementsRemoved', {
            removedObjects: removedObjects,
            viewToReact: appCtxSvc.ctx.aceActiveContext.key
        } );
    }
};

/**
 * It process the serviceData's partial errors.
 *
 * @param {Object} serviceData - the service data
 */
export let processPartialErrors = function( serviceData ) {
    var name = [];
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if ( serviceData.partialErrors && appCtxSvc.ctx.selected ) {
        name.push( appCtxSvc.ctx.selected.props.awb0UnderlyingObject.uiValues[0] );
        msgObj.name += name[0];
        for ( var x = 0; x < serviceData.partialErrors[0].errorValues.length; x++ ) {
            msgObj.msg += serviceData.partialErrors[0].errorValues[x].message;
            msgObj.msg += '<BR/>';
        }
        msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[0].errorValues[0].level ] );
    }

    return msgObj;
};

export default exports = {
    performPostSingleRemoveAction,
    processPartialErrors
};
