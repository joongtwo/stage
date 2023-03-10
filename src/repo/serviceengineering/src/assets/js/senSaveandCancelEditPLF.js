// Copyright (c) 2022 Siemens

/**
 * @module js/senSaveandCancelEditPLF
 */

import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';

let exports = {};

/**
 * Creates the text container element for tree command cell.
 * @param {String} attributeValue The attribute value
 *
 * @returns {DOMElement} text element
 */
const savePLFValues = function() {
    let deferred = AwPromiseService.instance.defer();
    let EditedPLFandProps = appCtxSvc.getCtx( 'EditedPLFandProps' );

    if( EditedPLFandProps ) {
        let inputData = {'info':EditedPLFandProps};
        if( inputData ) {
            soaSvc.post( 'MROCoreAw-2022-12-MROCoreAw', 'createOrUpdatePLFsOnOccurrence', inputData ).then( function( response ) {
                if( response ) {
                    let plfInfo = response.plfInfo;
                    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
                    let mroPart;
                    let i = -1;
                    plfInfo.forEach((element) => {
                        mroPartList.forEach((part,ind)=>{
                            if(part.partId === element.asset.uid){
                                mroPart = part;
                                i = ind;
                            }
                        });
                        let indices = [];
                            if(mroPart){
                                let usageVal = mroPart.updatedIsUsage?mroPart.updatedIsUsage:mroPart.isUsage;
                                if(!usageVal){
                                    let underlyingObject = mroPart.underlyingObject;
                                    mroPartList.forEach((part,index)=>{
                                        if(part.underlyingObject=== underlyingObject){
                                            let usageValtemp = part.updatedIsUsage?part.updatedIsUsage:part.isUsage;
                                            if(!usageValtemp){
                                                if(i!==index){
                                                    indices.push(index);
                                                }
                                            }
                                        }
                                    });
                                }
                                setUpdatedPlfInfo(mroPart,i);
                                if(indices.length>0){
                                    indices.forEach((ind)=>{
                                        setUpdatedPlfInfo(mroPartList[i],ind);
                                    });
                                }

                            }
                    });
                    mroPartList = appCtxSvc.getCtx( 'MROPartList' );
                    let updatedMroPartList = [];
                    mroPartList.forEach((part)=>{
                        part.updatedPlfValues = undefined;
                        part.updatedIsUsage = undefined;
                        updatedMroPartList.push(part);
                    });
                    
                    appCtxSvc.updateCtx( 'MROPartList',updatedMroPartList );
                    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
                    appCtxSvc.updateCtx("isEditButtonClicked", false);
                    deferred.resolve();
                }
            } , function( reason ) {
                deferred.reject( reason );
            } );
        }
    } else {
        eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
        appCtxSvc.updateCtx("isEditButtonClicked", false);
        deferred.resolve();
    }
    
    return deferred.promise;
};

/**
 * Returns updated value of plf attribute asssociated repsective plf column
 * @param {String} plfuid  uid of updated PLF object
 * @param {String} columnName PLF column name
 *
 * @returns {String} updated value of plf attribute
 */

 export let setUpdatedPlfInfo = function( element,index ) {
    let mroPartList = appCtxSvc.getCtx( 'MROPartList');
    Object.keys(mroPartList[index].plfValues).forEach((prop) => {
    switch (prop  ) {
        case 'isTraceable':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.isTraceable !==undefined){
                mroPartList[index].plfValues.isTraceable = element.updatedPlfValues.isTraceable;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'isSerialized':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.isSerialized !==undefined){
                mroPartList[index].plfValues.isSerialized = element.updatedPlfValues.isSerialized;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'isLot':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.isLot !==undefined){
                mroPartList[index].plfValues.isLot = element.updatedPlfValues.isLot;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'preserveQuantity':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.preserveQuantity !==undefined){
                mroPartList[index].plfValues.preserveQuantity = element.updatedPlfValues.preserveQuantity;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'isRotable':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.isRotable !==undefined){
                mroPartList[index].plfValues.isRotable = element.updatedPlfValues.isRotable;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'isConsumable':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.isConsumable !==undefined){
                mroPartList[index].plfValues.isConsumable = element.updatedPlfValues.isConsumable;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'sse0isAsset':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.sse0isAsset !==undefined){
                mroPartList[index].plfValues.sse0isAsset = element.updatedPlfValues.sse0isAsset;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
        case 'smr0skipPart':
            if(element.updatedPlfValues !== undefined && element.updatedPlfValues.smr0skipPart !==undefined){
                mroPartList[index].plfValues.smr0skipPart = element.updatedPlfValues.smr0skipPart;
                appCtxSvc.updateCtx( 'MROPartList',mroPartList );
            }
            break;
    }
    
});

if(element.updatedIsUsage !== undefined && element.updatedIsUsage !==undefined){
    mroPartList[index].isUsage = element.updatedIsUsage;
    appCtxSvc.updateCtx( 'MROPartList',mroPartList );
}

};

/**
 * Returns updated value of plf attribute asssociated repsective plf column
 * @param {String} plfuid  uid of updated PLF object
 * @param {String} columnName PLF column name
 *
 * @returns {String} updated value of plf attribute
 */

export let getEditedValue = function( plfuid, columnName ) {
    let plfValue = "";
    let mroPartList = appCtxSvc.getCtx( 'MROPartList');
    let mroPart;
    mroPartList.forEach((part)=>{
        if(part.partId === plfuid){
            mroPart = part;
        }
    });
    if(mroPart){
        switch ( columnName ) {
            case 'traceableValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.isTraceable !== undefined ? plfValue = mroPart.updatedPlfValues.isTraceable: plfValue = "";
                break;
            case 'serializedValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.isSerialized !== undefined ? plfValue = mroPart.updatedPlfValues.isSerialized: plfValue = "";
                break;
            case 'lotValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.isLot !== undefined ? plfValue = mroPart.updatedPlfValues.isLot: plfValue = "";
                break;
            case 'pQuantityValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.preserveQuantity !== undefined ? plfValue = mroPart.updatedPlfValues.preserveQuantity: plfValue = "";
                break;
            case 'rotableValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.isRotable !== undefined ? plfValue = mroPart.updatedPlfValues.isRotable: plfValue = "";
                break;
            case 'consumableValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.isConsumable !== undefined ? plfValue = mroPart.updatedPlfValues.isConsumable: plfValue = "";
                break;
            case 'assetValueColumn':
                mroPart.updatedPlfValues && mroPart.updatedPlfValues.sse0isAsset !== undefined ? plfValue = mroPart.updatedPlfValues.sse0isAsset: plfValue = "";
                break;
            case 'skipPartValueColumn':
                    mroPart.updatedPlfValues && mroPart.updatedPlfValues.smr0skipPart !== undefined ? plfValue = mroPart.updatedPlfValues.smr0skipPart: plfValue = "";
                    break;
            case 'usagePLFColumn':
                mroPart.updatedPlfValues && mroPart.updatedIsUsage !== undefined ? plfValue = mroPart.updatedIsUsage: plfValue = "";
                break;
        }
    }
    return plfValue;
};

/**
 * update PLF columns on SaveEdit and CancelEdit
 *
 */
let senCancelPLFEdits = function() {
    let updatedMroPartList = [];
    let mroPartList = appCtxSvc.getCtx( 'MROPartList');
    mroPartList.forEach((part)=>{
        part.updatedPlfValues = undefined;
        part.updatedIsUsage = undefined;
        updatedMroPartList.push(part);
    });
    appCtxSvc.unRegisterCtx( 'EditedPLFandProps' );
    appCtxSvc.updateCtx("isEditButtonClicked", false);
    eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
};

export default exports = {
    savePLFValues,
    senCancelPLFEdits,
    getEditedValue
};
