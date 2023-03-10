// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/occmgmtPwaCommandBarService
 */
import PwaCommandBarViewModel from 'viewmodel/PwaCommandBarViewModel';

export const occmgmtPwaCommandBarRenderFunction = ( props ) => {
    const {
        viewModel
    } = props;
    let { subPanelContext } = viewModel;

    return (
        <PwaCommandBarViewModel mselected={subPanelContext.occContext.selectedModelObjects} pselected={subPanelContext.baseSelection} subPanelContext={subPanelContext}>
</PwaCommandBarViewModel>
    );
};
