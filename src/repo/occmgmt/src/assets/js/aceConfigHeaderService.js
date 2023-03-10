// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * @module js/aceConfigHeaderService
 */
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import uwPropertyService from 'js/uwPropertyService';
import endItemUnitEffectivityConfigurationService from 'js/endItemUnitEffectivityConfigurationService';

var exports = {};

var populateEffectivityEndItem = function( occContext ) {
    let unitRangeEffGroups = endItemUnitEffectivityConfigurationService.getUnitEffectivityGroupsFromProductContextInfo( occContext );
    if( unitRangeEffGroups && unitRangeEffGroups.length > 0 ) {
        // For group effectivity end item is hidden as we cannot separate end units
        return uwPropertyService.createViewModelProperty( '', '', 'STRING',  '', [ '' ] );
    }
    var effectivityEndItem = occContext.productContextInfo.props.awb0EffEndItem;
    var topProduct = occContext.productContextInfo.props.awb0Product;
    var topProductObj = cdm.getObject( topProduct.dbValues[ 0 ] );
    var effEndItemStr;
    if( !effectivityEndItem || !effectivityEndItem.dbValues[ 0 ] ) {
        effEndItemStr = topProductObj.props.items_tag.uiValues[ 0 ];
        return uwPropertyService.createViewModelProperty( '(' + effEndItemStr + ')',
            '(' + effEndItemStr + ')', 'STRING',  '(' + effEndItemStr + ')',  [ '' ] );
    }
    var effEndItem = cdm.getObject( effectivityEndItem.dbValues[ 0 ] );
    if( !effEndItem.props.object_string ) {
        let effEndItemData = uwPropertyService.createViewModelProperty( '',
            '', 'STRING',  '', [ '' ] );
        dmSvc.getProperties( [ effEndItem.uid ], [ 'object_string' ] ).then( function() {
            effEndItemStr = effEndItem.props.object_string.dbValues[ 0 ];
            effEndItemData.dbValue = '(' + effEndItemStr + ')';
            effEndItemData.uiValue = '(' + effEndItemStr + ')';
        } );
        return effEndItemData;
    }
    effEndItemStr = effEndItem.props.object_string.dbValues[ 0 ];
    var effEndItemStrDisplayValue;
    let top = topProductObj.props.items_tag.uiValues[ 0 ];
    if (top === effEndItemStr)
    {
        effEndItemStrDisplayValue = '';
    }
    else 
    {
        effEndItemStrDisplayValue = '('+ effEndItemStr +')';
    }
    return uwPropertyService.createViewModelProperty( '(' + effEndItemStr + ')',
        '(' + effEndItemStr + ')', 'STRING',  '(' + effEndItemStr + ')',  [ effEndItemStrDisplayValue ] );
};

var populateSVROwningEndItem = function( pci ) {
    let svrOwiningItem = pci.props.awb0VariantRuleOwningRev;
    if( !svrOwiningItem || !svrOwiningItem.dbValues[ 0 ] ) {
        svrOwiningItem = pci.props.awb0Product;
    }
    let svrOwningItemRev = cdm.getObject( svrOwiningItem.dbValues[ 0 ] );
    let svrOwningItemRevStr = svrOwningItemRev.props.object_string.dbValues[ 0 ];
    var svrOwningItemRevStrDisplayValue;
    let top = pci.props.awb0Product.uiValues[0];
    if (top === svrOwningItemRevStr)
    {
        svrOwningItemRevStrDisplayValue = '';
    }
    else 
    {
        svrOwningItemRevStrDisplayValue = '('+ svrOwningItemRevStr +')';
    }
   return uwPropertyService.createViewModelProperty( '(' + svrOwningItemRevStr + ')',
       '(' + svrOwningItemRevStr + ')', 'STRING',  '(' + svrOwningItemRevStr + ')',  [ svrOwningItemRevStrDisplayValue ] );
};
export let initializeAceConfigHeader = function( occContext ) {
    var pci = occContext.productContextInfo;
    if( pci ) {
        const effectivityEndItem =  populateEffectivityEndItem( occContext );
        const SVROwningItemRev = populateSVROwningEndItem( pci );
        return { effectivityEndItem, SVROwningItemRev };
    }
};

export default exports = {
    initializeAceConfigHeader
};
