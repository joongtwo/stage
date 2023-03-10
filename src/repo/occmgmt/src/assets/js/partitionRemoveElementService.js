// Copyright (c) 2022 Siemens

/**
 * Removal of partition structure elements
 *
 * @module js/partitionRemoveElementService
 */
import appCtxSvc from 'js/appCtxService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cdmService from 'soa/kernel/clientDataModel';

var exports = {};

/**
 Function gets called remove element soa return created lines.
 *  The Use case is for Structure Partition.
 * When we remove Child partition line referenced under the single parent,
 * it becomes the top level partition line
 * We need to refresh the PWA to show the created
 * partition line
 * */
export let updateAcePwaWithCreatedPartition = function( removedElementUIDs, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( 'pwaReset', true, occContext );

    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
    if( inactiveView ) {
        //for every selected object get its parent hierarchy and see if is present in removed objects
        var selectedObjectsWhoseParentIsRemoved = [];
        _.forEach( appCtxSvc.ctx[ inactiveView ].selectedModelObjects, ( selectedObj ) => {
            var selection = selectedObj;
            do {
                var parentUid = occmgmtUtils.getParentUid( selection );
                if( parentUid && removedElementUIDs.includes( parentUid ) ) {
                    selectedObjectsWhoseParentIsRemoved.push( selectedObj.uid );
                    selection = null;
                } else {
                    selection = cdmService.getObject( parentUid );
                }
            } while( selection );
        } );

        if( selectedObjectsWhoseParentIsRemoved.length > 0 ) {
            eventBus.publish( 'aceElementsDeSelectedEvent', {
                elementsToDeselect: selectedObjectsWhoseParentIsRemoved,
                viewToReact: inactiveView
            } );
        }
        eventBus.publish( 'acePwa.reset', {
            retainTreeExpansionStates: true,
            viewToReset: inactiveView,
            silentReload: true
        } );
    }
};

/**
 * Structure partition Remove Element service utility
 */

export default exports = {
    updateAcePwaWithCreatedPartition
};
