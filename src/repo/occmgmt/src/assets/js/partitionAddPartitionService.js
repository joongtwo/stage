// Copyright (c) 2022 Siemens

/**
 * @module js/partitionAddPartitionService
 */
import aceAddelementService from 'js/addElementService';
import _ from 'lodash';

var exports = {};

/*
 * The Function returns the topline SRUID.
 * 1 Under Workset Hierarchy it finds the topline uid by searching in the elementToPCIMap using pci_uid
 * 2 If not under Workset it returns the t_uid.
 */
export let getProductTopLine = function( occContext ) {
    if ( occContext.topElement.props.awb0UnderlyingObjectType.dbValues[0] === 'Fnd0WorksetRevision' ) {
        return _.findKey( occContext.elementToPCIMap, _.matches( occContext.currentState.pci_uid ) );
    }

    return occContext.currentState.t_uid;
};

/*
 * Wapper for setStateAddElementInputParentElementToSelectedElement from addElementService
 */
export let setStateAddElementInputParentElementToSelectedElement = function( data, occContext ) {
    var parentUid = occContext.currentState.c_uid;
    var parentToLoadAllowedTypes = getProductTopLine( occContext );
    if ( parentToLoadAllowedTypes !== null ) {
        return aceAddelementService.setStateAddElementInputParentElementToSelectedElement( parentUid, data, parentToLoadAllowedTypes );
    }
};

export default exports = {
    getProductTopLine,
    setStateAddElementInputParentElementToSelectedElement
};
