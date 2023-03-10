// Copyright (c) 2022 Siemens

/**
 * @module js/senPLFCellRenderer
 */
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import { svgString as miscUiCheckboxUnselectedPressed } from 'image/miscUiCheckboxUnselectedPressed18.svg';
import { svgString as miscUiCheckboxSelected } from 'image/miscUiCheckboxSelected18.svg';
import { svgString as cmdCancel } from 'image/cmdCancel24.svg';
import senSaveandCancelEditPLF from 'js/senSaveandCancelEditPLF';

let exports = {};


/**
 * Creates the Icon container element for tree command cell.
 *
 * @param {Object} refObj the refernce object with PLF uid/vmo uid and plfValue/usagePlf value for the cell
 * @param {DOMElement} parentElement containerElement
 * @param {Object} columnName the column associated with the cell

 * @returns {DOMElement} icon element
 */
const getIconCellElement = function( refObj, parentElement, columnName, vmo ) {

    let attributeValue = getAttributeValue(refObj, columnName);

    let icon = getIconSource( attributeValue );
    let altText = getAlternateText( columnName, attributeValue );

    if( parentElement ) {
        let iconElement = document.createElement( 'span' );
        iconElement.className = 'aw-sen-visual-indicator';
        iconElement.innerHTML = icon;
        iconElement.title = altText;
        refObj.vmo = vmo;
        addUsagePlfIndication(parentElement,refObj.usagePLFValue);
        iconElement.addEventListener( 'click', function(event) {
            parentElement = this.parentNode;
            if( appCtxSvc.getCtx( 'editInProgress' ) ) {
                parentElement.removeChild( iconElement );
                updatePlfValue(attributeValue, refObj, columnName, parentElement);
            }
        } );
        return iconElement;
    }
    return null;
};

/**
 * Update UI indication as per usage PLF value
 *
 */
let addUsagePlfIndication = function(parentElement,usagePLFValue)
{

    if(usagePLFValue === true)
    {
        parentElement.classList.add( 'aw-jswidgets-editableGridCell' );
        parentElement.classList.add( 'aw-sen-bordered-cell' );
        if(appCtxSvc.getCtx( 'isEditButtonClicked' ))
        {
            parentElement.classList.add( 'aw-sen-cell-highlight' );
        }
    }
};


/**
 * Get attribute value
 *
 */
let getAttributeValue = function(refObj, columnName) {

    let attributeValue ="";

    if (appCtxSvc.getCtx("isEditButtonClicked"))
    {
        // check if values are edited and get edited values as attribute values
        if(columnName==="usagePLFColumn")
        {
            attributeValue = senSaveandCancelEditPLF.getEditedValue(refObj.vmo.uid, columnName);
            if(!attributeValue)
            {
                attributeValue = refObj.usagePLFValue;
            }
        }
        else{
            attributeValue = senSaveandCancelEditPLF.getEditedValue(refObj.plfuid, columnName);
            if(!attributeValue)
            {
                attributeValue = refObj.plfValue;
            }
        }
    }
    else
    {
        attributeValue = columnName==="usagePLFColumn" ? refObj.usagePLFValue : refObj.plfValue;
    }
    return attributeValue;
};


/**
 * updates plfValue/usagePlf value on edit
 *
 * @param {String} attributeValue updated plf/usage plf value
 * @param {Object} refObj the refernce object with PLF uid/vmo uid and plfValue/usagePlf value for the cell
 * @param {Object} columnName the column associated with the cell
 * @param {DOMElement} parentElement containerElement
 *
 */
let  updatePlfValue = function(attributeValue, refObj, columnName, parentElement){

        let iconElement;
        if(attributeValue === "No PLF" || attributeValue === undefined)
        {
            columnName === "usagePLFColumn" ? refObj.usagePLFValue = "No PLF" : refObj.plfValue = "No PLF";
            iconElement = getIconCellElement( refObj, parentElement, columnName,refObj.vmo );
        }
        else
        {
            let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
            let mroPart;
            let partIndex = -1;
            mroPartList.forEach((part,index)=>{
                if(part.partId=== refObj.vmo.uid ){
                    mroPart = part;
                    partIndex = index;
                }
            });

            if( attributeValue === true) {
                if( columnName==="usagePLFColumn")
                {
                    if(mroPart.isUsage ===  true)
                    {
                        mroPart.updatedIsUsage = attributeValue;
                        refObj.usagePLFValue = attributeValue;
                    }
                    else{
                        addOrRemoveClassesToOtherPLFAttributes(parentElement, "remove");
                        mroPart.updatedIsUsage = !attributeValue;
                        refObj.usagePLFValue = !attributeValue;
                    }
                    mroPartList[partIndex] =mroPart;
                    appCtxSvc.updateCtx( 'MROPartList', mroPartList );
                }
                else{
                    refObj.plfValue = false;
                    parentElement.classList.add( 'changed' );
                }
                iconElement = getIconCellElement( refObj, parentElement, columnName,refObj.vmo );

            } else if( attributeValue === false) {
                if( columnName==="usagePLFColumn")
                {
                    addOrRemoveClassesToOtherPLFAttributes(parentElement, "add");
                    mroPart.updatedIsUsage = !attributeValue;
                    refObj.usagePLFValue = !attributeValue;
                    mroPartList[partIndex] =mroPart;
                    appCtxSvc.updateCtx( 'MROPartList', mroPartList );
                    parentElement.classList.add( 'changed' );
                }
                else{
                    refObj.plfValue = true;
                    parentElement.classList.add( 'changed' );
                }
                iconElement = getIconCellElement( refObj, parentElement, columnName,refObj.vmo );
            }

            updateEditedPLFandProps( refObj, columnName );
            updateEditedPropsValues( refObj, columnName );
        }
        parentElement.appendChild( iconElement );
};


let addOrRemoveClassesToOtherPLFAttributes = function(parentElement, action){
    let UsagePlfId = parentElement.parentElement.getAttribute('id');
    let colNum = UsagePlfId[UsagePlfId.length-1];
    let prefixId = UsagePlfId.slice(0,UsagePlfId.length-1);
    if(parseInt(colNum)){
        let nextcol = parseInt(colNum) +1;
        let nextCell = parentElement.getRootNode().getElementById(prefixId+nextcol.toString());
        if(action === "add")
        {
            while(nextCell && nextCell.getElementsByClassName('aw-sen-visual-indicator').length>0){
                nextCell.getElementsByClassName('aw-splm-tableCellTop').item(0).classList.add( 'aw-sen-cell-highlight' );
                nextCell.getElementsByClassName('aw-splm-tableCellTop').item(0).classList.add( 'aw-sen-bordered-cell' );
                nextcol =nextcol +1;
                nextCell = parentElement.getRootNode().getElementById(prefixId+nextcol.toString());
            }
        }
        else if(action === "remove"){
            while(nextCell && nextCell.getElementsByClassName('aw-sen-visual-indicator').length>0){
                nextCell.getElementsByClassName('aw-splm-tableCellTop').item(0).classList.remove( 'aw-sen-cell-highlight' );
                nextCell.getElementsByClassName('aw-splm-tableCellTop').item(0).classList.remove( 'aw-sen-bordered-cell' );
                nextcol =nextcol +1;
                nextCell = parentElement.getRootNode().getElementById(prefixId+nextcol.toString());
            }
        }
    }
};


/**
 * Returns property name asssociated with column name in DB
 * @param {String} columnName PLF column name
 *
 * @returns {String} property name asssociated with column name in DB
 */
 let getPropNameIndb = function( columnName ) {
    let propertyName = '';
    switch ( columnName ) {
        case 'traceableValueColumn':
            propertyName = 'isTraceable';
            break;
        case 'serializedValueColumn':
            propertyName = 'isSerialized';
            break;
        case 'lotValueColumn':
            propertyName = 'isLot';
            break;
        case 'pQuantityValueColumn':
            propertyName = 'preserveQuantity';
            break;
        case 'rotableValueColumn':
            propertyName = 'isRotable';
            break;
        case 'consumableValueColumn':
            propertyName = 'isConsumable';
            break;
        case 'assetValueColumn':
            propertyName = 'sse0isAsset';
            break;
        case 'skipPartValueColumn':
            propertyName = 'smr0skipPart';
            break;
    }
    return propertyName;
};

/**
 * updates the edited PLF uid and properties map in the ctx
 *
 * @param {Object} refObj the refernce object with PLF uid and plfValue for the cell
 * @param {Object} columnName the column associated with the cell
 *
 */
let updateEditedPLFandProps = function( refObj, columnName ) {
    if( appCtxSvc.getCtx( 'EditedPLFandProps' ) ) {
        let plfPropValues = appCtxSvc.getCtx( 'EditedPLFandProps' );
        let match = false;
        plfPropValues.forEach((plfPropValue,index) => {
            let plfuid = refObj.plfuid? refObj.plfuid : refObj.vmo.uid;
            if(plfPropValue.asset.uid === plfuid){
                let plfValues = plfPropValue.plfValues;
                if(columnName==='usagePLFColumn'){
                    plfPropValue.isUsagePLF = refObj.usagePLFValue;
                    let mroPart;
                    let mroPartList = appCtxSvc.getCtx( 'MROPartList');
                    mroPartList.forEach((part)=>{
                        if(part.partId === plfuid ){
                            mroPart = part;
                        }
                    });
                    let updatedPlfProps = Object.keys(plfValues);
                    let plfKeys = Object.keys(mroPart.plfValues);
                    plfKeys.forEach((plfKey)=>{
                        if(!updatedPlfProps.includes(plfKey)){
                            plfValues[plfKey] = mroPart.plfValues[plfKey];
                        }
                    });
                }else{
                    plfValues[getPropNameIndb(columnName)] = refObj.plfValue;
                    plfPropValue.plfValues = plfValues;
                }
                plfPropValues[index] = plfPropValue;
                match = true;
            }
        });
        if(!match){
            let plfValues = {};
            if(columnName !== 'usagePLFColumn'){
                plfValues[getPropNameIndb(columnName)] = refObj.plfValue;
            }else{
                let mroPart;
                let mroPartList = appCtxSvc.getCtx( 'MROPartList');
                mroPartList.forEach((part)=>{
                    if(part.partId=== refObj.vmo.uid ){
                        mroPart = part;
                    }
                });
                plfValues = mroPart.plfValues;
            }
            let plfPropValue = {
                'asset':{
                    'type': refObj.vmo.type,
                    'uid': refObj.vmo.uid
                },
                'isUsagePLF': refObj.usagePLFValue?refObj.usagePLFValue:false,
                'plfValues':plfValues
            };
            plfPropValues.push(plfPropValue);
        }
        appCtxSvc.updateCtx( 'EditedPLFandProps', plfPropValues );
    } else {
        let plfPropValues = [];
        let plfValues = {
        };
        if(columnName !== 'usagePLFColumn'){
            plfValues[getPropNameIndb(columnName)] = refObj.plfValue;
        }else{
            let mroPart;
            let mroPartList = appCtxSvc.getCtx( 'MROPartList');
            mroPartList.forEach((part)=>{
                if(part.partId=== refObj.vmo.uid ){
                    mroPart = part;
                }
            });
            plfValues = mroPart.plfValues;
        }
        let plfPropValue = {
            'asset':{
                'type': refObj.vmo.type,
                'uid': refObj.vmo.uid
            },
            'isUsagePLF': refObj.usagePLFValue?refObj.usagePLFValue:false,
            'plfValues':plfValues
        };
        plfPropValues.push(plfPropValue);
        appCtxSvc.updateCtx( 'EditedPLFandProps', plfPropValues );
    }
};

/**
 * updates the values of edited PLFproperties in respective map in the ctx
 *
 * @param {Object} refObj the refernce object with PLF uid and plfValue for the cell
 * @param {Object} columnName the column associated with the cell
 *
 */
let updateEditedPropsValues = function( refObj, columnName ) {
    if( refObj && columnName ) {
        let mroPartList = appCtxSvc.getCtx( 'MROPartList');
        let mroPart;
        let plfUid = refObj.plfuid?refObj.plfuid:refObj.vmo.uid;
        let index = -1;
        mroPartList.forEach((part,i)=>{
            if(part.partId=== plfUid){
                mroPart = part;
                index = i;
            }
        });
        if(mroPart){
            mroPart.updatedPlfValues = mroPart.updatedPlfValues?mroPart.updatedPlfValues:{};
            switch ( columnName ) {
                case 'traceableValueColumn':
                    mroPart.updatedPlfValues.isTraceable = refObj.plfValue;
                    break;
                case 'serializedValueColumn':
                    mroPart.updatedPlfValues.isSerialized = refObj.plfValue;
                    break;
                case 'lotValueColumn':
                    mroPart.updatedPlfValues.isLot = refObj.plfValue;
                    break;
                case 'pQuantityValueColumn':
                    mroPart.updatedPlfValues.preserveQuantity = refObj.plfValue;
                    break;
                case 'rotableValueColumn':
                    mroPart.updatedPlfValues.isRotable = refObj.plfValue;
                    break;
                case 'consumableValueColumn':
                    mroPart.updatedPlfValues.isConsumable = refObj.plfValue;
                    break;
                case 'assetValueColumn':
                    mroPart.updatedPlfValues.sse0isAsset = refObj.plfValue;
                    break;
                case 'skipPartValueColumn':
                        mroPart.updatedPlfValues.smr0skipPart = refObj.plfValue;
                        break;
            }
            mroPartList[index] = mroPart;
            appCtxSvc.updateCtx( 'MROPartList', mroPartList);
        }
    }
};

/**
 * Gets icon image source based on parameters given
 *
 * @param {String} attributeValue the value of the plf attribute
 *
 */
let getIconSource = function( attributeValue ) {
    let imagePath = '';

    if( attributeValue === true) {
        imagePath = miscUiCheckboxSelected;
    } else if( attributeValue === false) {
        imagePath = miscUiCheckboxUnselectedPressed;
    } else {
        imagePath = cmdCancel;
    }
    return imagePath;
};

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
function getLocalizedMessage( resourceFile, resourceKey, messageParam ) {
    let localizedValue = null;
    let resource = resourceFile;
    let localTextBundle = localeService.getLoadedText( resource );
    if( localTextBundle ) {
        localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
    } else {
        let asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }
    return localizedValue;
}

/**
 * Get the alternate Text for icons for PLF attributes.
 * @param {Object} columnName - The column associated with the cell
 * @param {String} attributeValue - The value of the PLF attribute
 * @returns {String} altTextforPLFValues - The Alternate text for icons for PLF attributes.
 */
let getAlternateText = function( columnName, attributeValue ) {
    let altTextforPLFValues = '';
    if( attributeValue === 'No PLF' ) {
        altTextforPLFValues = getLocalizedMessage( 'senMessages', 'NoPLFValue', null );
    } else {
        switch ( columnName ) {
            case 'traceableValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'tracableTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'tracableFalse', null );
                }
                break;
            case 'serializedValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'serializedTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'serializedFalse', null );
                }
                break;
            case 'lotValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'lotTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'lotFalse', null );
                }
                break;
            case 'pQuantityValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'preserveQuantityTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'preserveQuantityFalse', null );
                }
                break;
            case 'rotableValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'rotableTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'rotableFalse', null );
                }
                break;
            case 'consumableValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'consumableTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'consumableFalse', null );
                }
                break;
            case 'assetValueColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'assetTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'assetFalse', null );
                }
                break;
            case 'skipPartValueColumn':
                if( attributeValue ) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'skipPartTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'skipPartFalse', null );
                }
                break;
            case 'usagePLFColumn':
                if( attributeValue) {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'usagePLFTrue', null );
                } else {
                    altTextforPLFValues = getLocalizedMessage( 'senMessages', 'usagePLFFalse', null );
                }
                break;
        }
    }
    return altTextforPLFValues;
};

export default exports = {
    getIconCellElement,
    getLocalizedMessage
};
