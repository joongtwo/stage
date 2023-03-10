// Copyright (c) 2022 Siemens

/**
 * @module js/senPLFTablePropertyRenderer
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import senPLFCellRenderer from 'js/senPLFCellRenderer';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';

let exports = {};

/**
 * Calls a method get partLogisticForm list using  mroPartList and the relation.
 *
 */
let getPLF = function(mroPartListInput) {
    let deferred = AwPromiseService.instance.defer();

    let input = {
        info: mroPartListInput
    };

    let mroPartList = [];
    soaSvc.postUnchecked( 'MROCoreAw-2022-12-MROCoreAw', 'getPLFsOnOccurrence', input ).then( function( response ) {
        let outputArray = _.values( response.plfInfo );
        _.forEach( outputArray, function( output,itr ) {
            let partObject = {};
            partObject.part = output.asset;
            partObject.partId = output.asset.uid;
            partObject.underlyingObject = output.asset.props.awb0UnderlyingObject.dbValues[0];
            partObject.isUsage = output.isUsagePLF;
            partObject.plfValues = output.plfValues;
            mroPartList[itr] = partObject;
        } );
        appCtxSvc.updateCtx( 'MROPartList', mroPartList );
        eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
        deferred.resolve();
    }, function( reason ) {
        deferred.reject( reason );
    } );

    return deferred.promise;
};


/**
 * Calls a method get partList and partRevisionList using getProperties SOA and vnos.
 * @param {Object} vmos selectd view model object
 *
 */
let getPartList = function( vmos ) {
    let trgVmosToUpdate = vmos;
    let partList = [];

    _.forEach( trgVmosToUpdate, function( trgVmoToUpdate ) {
        var trgVmoToUpdateObject = cdm.getObject( trgVmoToUpdate.uid );
        if ( trgVmoToUpdateObject ) {
            let mo = {
                type: trgVmoToUpdateObject.type,
                uid: trgVmoToUpdateObject.uid
            };
            partList.push(mo);
        }
    } );
    eventBus.publish('senSbom.loadPLF',partList);
    return partList;
};

/**
 * getPLFPropertyValue
 * @param {Object} vmo selectd view model object
 * @param {String} propertyflag flag for the PLF property
 */
let getPLFPropertyValue = function( vmo, propertyflag ) {
    let valueUpdated = 0;
    let refObj = {};
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    let mroPart;
    mroPartList.forEach((part)=>{
        if(part.partId=== vmo.uid){
            mroPart = part;
        }
    });
    if( vmo.uid && cdm.getObject( vmo.uid ) && cdm.getObject( vmo.uid ).props.awb0UnderlyingObject ) {
        {
            let PLF;

            if( mroPart) {
                PLF = mroPart.plfValues;
                refObj.plfuid = vmo.uid;
                refObj.usagePLFValue = mroPart.isUsage;
                if( PLF ) {
                    switch ( propertyflag ) {
                        case 'traceableValueColumn':
                            refObj.plfValue = PLF.isTraceable;
                            break;
                        case 'serializedValueColumn':
                            refObj.plfValue = PLF.isSerialized;
                            break;
                        case 'lotValueColumn':
                            refObj.plfValue = PLF.isLot;
                            break;
                        case 'pQuantityValueColumn':
                            refObj.plfValue = PLF.preserveQuantity;
                            break;
                        case 'rotableValueColumn':
                            refObj.plfValue = PLF.isRotable;
                            break;
                        case 'consumableValueColumn':
                            refObj.plfValue = PLF.isConsumable;
                            break;
                        case 'assetValueColumn':
                            refObj.plfValue = PLF.sse0isAsset;
                            break;
                        case 'skipPartValueColumn':
                                refObj.plfValue = PLF.smr0skipPart;
                                break;
                    }
                } else {
                    refObj.plfuid = 'No PLF';
                    refObj.plfValue = 'No PLF';
                }
                valueUpdated = 1;
            }
        }
    }
    if( valueUpdated === 1 ) {
        eventBus.publish( 'senSbomTreeTable.plTable.updated', { updatedObjects: [ vmo ] } );
    }
    return refObj;
};

let getUsagePlfValue= function( refObj, vmo){
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    let mroPart;
    mroPartList.forEach((part)=>{
        if(part.partId=== vmo.uid){
            mroPart = part;
        }
    });

    if( mroPart) {
        if( mroPart) {
            refObj.plfuid = vmo.uid;
            refObj.usagePLFValue = mroPart.isUsage;
        }
    }
    return refObj;
};

/**
 * Calls methods to get PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 *
 */
let getPLFValueRenderer = function( vmo, containerElement, columnName ) {
    let refobj = {
        usagePLFValue :false
    };

    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );


    if( mroPartList ) {
        let mroPart;
        mroPartList.forEach((part)=>{
            if(part.partId=== vmo.uid){
                mroPart = part;
            }
        });
        if(mroPart){
            switch ( columnName ) {
                case 'traceableValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.isTraceable !== undefined )|| (mroPart.updatedPlfValues && mroPart.updatedPlfValues.isTraceable !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.isTraceable !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.isTraceable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.isTraceable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'traceableValueColumn' );
                    }
                    break;
                }
                case 'serializedValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.isSerialized !== undefined) || (mroPart.updatedPlfValues && mroPart.updatedPlfValues.isSerialized !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.isSerialized !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.isSerialized;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.isSerialized;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'serializedValueColumn' );
                    }
                    break;
                }
                case 'lotValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.isLot !== undefined )|| (mroPart.updatedPlfValues && mroPart.updatedPlfValues.isLot !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.isLot !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.isLot;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.isLot;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'lotValueColumn' );
                    }
                    break;
                }
                case 'pQuantityValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.preserveQuantity !== undefined) || (mroPart.updatedPlfValues && mroPart.updatedPlfValues.preserveQuantity !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.preserveQuantity !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.preserveQuantity;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.preserveQuantity;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'pQuantityValueColumn' );
                    }
                    break;
                }
                case 'rotableValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.isRotable !== undefined) || (mroPart.updatedPlfValues && mroPart.updatedPlfValues.isRotable !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.isRotable !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.isRotable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.isRotable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'rotableValueColumn' );
                    }
                    break;
                }
                case 'consumableValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.isConsumable !== undefined) || (mroPart.updatedPlfValues && mroPart.updatedPlfValues.isConsumable !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.isConsumable !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.isConsumable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.isConsumable;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'consumableValueColumn' );
                    }
                    break;
                }
                case 'assetValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.sse0isAsset !== undefined )|| (mroPart.updatedPlfValues && mroPart.updatedPlfValues.sse0isAsset !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.sse0isAsset !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.sse0isAsset;
                            refobj.plfValue = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.sse0isAsset;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'assetValueColumn' );
                    }
                    break;
                }
                case 'skipPartValueColumn':{
                    if( ((mroPart.plfValues && mroPart.plfValues.smr0skipPart !== undefined) || (mroPart.updatedPlfValues && mroPart.updatedPlfValues.smr0skipPart !== undefined) )&& !appCtxSvc.getCtx( 'editInProgress' ) ) {
                        if(mroPart.updatedPlfValues && mroPart.updatedPlfValues.smr0skipPart !== undefined){
                            refobj.plfValue = mroPart.updatedPlfValues.smr0skipPart;
                            refobj.plfValue = getUsagePlfValue(refobj,vmo);
                        }else{
                            refobj.plfValue = mroPart.plfValues.smr0skipPart;
                            refobj = getUsagePlfValue(refobj,vmo);
                        }
                    } else {
                        refobj = getPLFPropertyValue( vmo, 'skipPartValueColumn' );
                    }
                    break;
                }
            }
        }
        let iconElement = senPLFCellRenderer.getIconCellElement( refobj, containerElement, columnName, vmo );
        if( iconElement !== null ) {
            containerElement.appendChild( iconElement );
        }
    }
};




export default exports = {
    getPLFValueRenderer,
    getPartList,
    getPLF
};
