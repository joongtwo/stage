// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import KanbanViewCallbacks from "js/KanbanViewCallbacks";
import AwStateService from 'js/awStateService';

export default class SmKanbanViewCallbacks extends KanbanViewCallbacks {

    constructor( kanbanProps ) {
        super( kanbanProps );
    }

    onListAfterDrop( dragContext, e, list ) {
        // if we move an item from one list to another
        if( dragContext.from !== dragContext.to ) {
            var dragDropObject = {
                dragContext: _.cloneDeep( dragContext ),
                e: e,
                list: list,
                draggedObjectPrevIndexMap: this.draggedObjectPrevIndexMap
            };
            let atomicData = this.kanbanProps.atomicDataRef.kanbanState.getAtomicData();
            let atomicDataDestructured = { ...atomicData };
            atomicDataDestructured.operation = {
                action: 'dragDropCard',
                value: dragDropObject
            };
            this.kanbanProps.atomicDataRef.kanbanState.setAtomicData( atomicDataDestructured );
        }
    }

    onListItemClick( objectUid, mouseEvent, node, list ) {
        let self = this; //This is added to fix error "class-methods-use-this"
        var path0 = mouseEvent.path[ 0 ].className;
        if( objectUid && path0 === 'webix_kanban_user_avatarRight' ) {
            var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
            var options = {};
            var toParams = {};

            toParams.uid = objectUid;
            options.inherit = false;

            AwStateService.instance.go( showObject, toParams, options );
        }
    }

}
