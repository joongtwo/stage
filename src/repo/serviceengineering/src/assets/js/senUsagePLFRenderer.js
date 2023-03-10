
 import senPLFCellRenderer from 'js/senPLFCellRenderer';
 import appCtxSvc from 'js/appCtxService';
 import eventBus from 'js/eventBus';
 let exports = {};



 /**
  * Calls methods to get Usage PLF property value as cell text element. Appends it to the container element.
  *
  * @param {Object} vmo the vmo for the cell
  * @param {DOMElement} containerElement containerElement
  * @param {Object} columnName the column associated with the cell
  *
  */
 export let usagePLFRenderer = function( vmo, containerElement, columnName ) {
    let refObj={};
    let usagePLFValue = 'No PLF' ;
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    let mroPart;
    if(mroPartList){
        mroPartList.forEach((part)=>{
            if(part.partId=== vmo.uid){
                mroPart = part;
            }
        });
    }
    
    if(mroPart){
        if(mroPart.partId === vmo.uid && vmo.parentUid){
            usagePLFValue = mroPart.updatedIsUsage!==undefined?mroPart.updatedIsUsage:mroPart.isUsage;
        }
    }
    refObj = {
        vmo:vmo,
        usagePLFValue : usagePLFValue
    };

    let iconElement = senPLFCellRenderer.getIconCellElement( refObj, containerElement, columnName, vmo );
    if( iconElement !== null )
    {
    containerElement.appendChild( iconElement );
    }
 };

export default exports = {
    usagePLFRenderer
};

