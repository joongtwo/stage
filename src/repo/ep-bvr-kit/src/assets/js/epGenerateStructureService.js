// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 */

/**
 * @module js/epGenerateStructureService
 */

import epInitializationService from 'js/epInitializationService';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import eventBus from 'js/eventBus';

/**
 * Creates PlantBop or/and MBOM into CC based on Rules defined using RuleStream application.
 * @param { Object } sourceObject - object into which newly created structures will get added. E.g: CCObject
 */
export function generateStructuresUsingRuleStream( sourceObject ) {
    if( sourceObject ) {
        const saveInputWriter = saveInputWriterService.get();
        saveInputWriter.addGenerateStructureInput( sourceObject.uid );
        return epSaveService.saveChanges( saveInputWriter, true, [ sourceObject ] ).then( function( result ) {
            if( result.ServiceData && !result.ServiceData.partialErrors ) {
                return epInitializationService.loadModel();
            }
            eventBus.publish( 'aw.closePopup' );
        } );
    }
}
export default {
    generateStructuresUsingRuleStream
};
