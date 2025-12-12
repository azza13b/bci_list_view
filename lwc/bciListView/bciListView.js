import { LightningElement, api, track, wire } from 'lwc';
import getBciProject from '@salesforce/apex/BciController.getBciProject';
import getProjectCount from '@salesforce/apex/BciController.getProjectCount';
import getCategoryPicklistValues from '@salesforce/apex/BciController.getCategoryPicklistValues';
import getProjectStagePicklistValues from '@salesforce/apex/BciController.getProjectStagePicklistValues';
import getCouncilPicklistValues from '@salesforce/apex/BciController.getCouncilPicklistValues';

const COLUMNS = [
    { label: 'Last Updated', fieldName: 'Time_Stamp__c', initialWidth: 120, type: 'date', sortable: true, hideDefaultActions: true },
    { label: 'Overview', fieldName: 'recordLink', type: 'url', hideDefaultActions: true, typeAttributes: { label: { fieldName: 'BCI_Name__c' }, target: '_blank' } },
    { label: 'Location', fieldName: 'Location__c', type: 'text', sortable: true, initialWidth: 270, hideDefaultActions: true },
    { label: 'Value', fieldName: 'Value__c', type: 'text', sortable: true, initialWidth: 120, hideDefaultActions: true },
    { label: 'Developer', fieldName: 'Developer__c', type: 'text', hideDefaultActions: true },
    {
        label: "Lead Priority",
        type: "richTextColumn",
        fieldName: "AI_Lead_Priority__c",
        initialWidth: 110,
        hideDefaultActions: true,
        typeAttributes: {
            richText: { fieldName: "AI_Lead_Priority__c" },
            cssClass: 'center-align'
        }
    }
];

export default class BciListView extends LightningElement {
    @track isBciMapModalOpen = false;
    @track groupValue = 'All_Projects';
    @track columns = JSON.parse(JSON.stringify(COLUMNS));
    @track startDate = null;
    @track endDate = null;
    @track errorMessage = '';
    @track categoryOptions = [];
    @track projectStageOptions = [];
    @track councilOptions = [];
    @track showCategoryModal = false;
    @track showCouncilModal = false;
    @track filterValues = {
        Cat_1_Name: [],
        Project_Stage: [],
        Council: [],
        Start_Date: null,
        End_Date: null,
        Developer: null,
        State: null,
        LastUpdated: 'Last 3 Months',
        Country: ['Australia'],
        HideViewedProjects: false
    };
    @track bciProjects = [];
    @track totalValue = 0;

    @track offset = 0;
    @track limit = 150;
    @track total = 0;
    @track isLoading = false;
    @track initialLoading = true;
    @track loadMoreStatus = '';

    @track sortBy;
    @track sortDirection;

    @track showFilterPanel = true;

    // Accordion section states - only Time Range open by default
    @track expandedSections = {
        timeRange: true,
        location: false,
        details: false,
        viewOptions: false
    };

    @wire(getCategoryPicklistValues)
    wiredPicklistValues({ data, error }) {
        if (data) {
            this.categoryOptions = data.map(option => ({
                label: option.label,
                value: option.value,
                isChecked: false
            }));
        } else if (error) {
            console.error('Error fetching picklist values', error);
        }
    }

    @wire(getProjectStagePicklistValues)
    wiredPSPicklistValues({ data, error }) {
        if (data) {
            this.projectStageOptions = data.map(option => ({
                label: option.label,
                value: option.value,
                isChecked: false
            }));
        } else if (error) {
            console.error('Error fetching picklist values', error);
        }
    }

    @wire(getCouncilPicklistValues)
    wiredCPicklistValues({ data, error }) {
        if (data) {
            this.councilOptions = data.map(option => ({
                label: option.label,
                value: option.value,
                isChecked: false
            }));
        } else if (error) {
            console.error('Error fetching picklist values', error);
        }
    }

    async connectedCallback() {
        this.initData();
    }

    handleMenuSelect(event) {
        if (event.detail.value === 'resetWidths') {
            this.columns = JSON.parse(JSON.stringify(COLUMNS));
        }
    }

    handleResetColumnWidths() {
        this.columns = JSON.parse(JSON.stringify(COLUMNS));
    }

    @track countryOptions = [
        { label: 'Australia', value: 'Australia', isChecked: true },
        { label: 'New Zealand', value: 'New Zealand', isChecked: false },
        { label: 'United Kingdom', value: 'United Kingdom', isChecked: false }
    ];

    // ============================================
    // Computed Properties - Stats
    // ============================================

    get formattedTotal() {
        return new Intl.NumberFormat('en-AU').format(this.total);
    }

    get formattedTotalValue() {
        if (this.totalValue >= 1000000000) {
            return '$' + (this.totalValue / 1000000000).toFixed(1) + 'B';
        } else if (this.totalValue >= 1000000) {
            return '$' + (this.totalValue / 1000000).toFixed(1) + 'M';
        } else if (this.totalValue >= 1000) {
            return '$' + (this.totalValue / 1000).toFixed(0) + 'K';
        }
        return '$' + new Intl.NumberFormat('en-AU').format(this.totalValue);
    }

    // ============================================
    // Computed Properties - Filter Options
    // ============================================

    get lastUpdatedOptions() {
        const options = [
            { label: 'Last 7 Days', value: 'Last 7 Days', shortLabel: '7d' },
            { label: 'Last 30 Days', value: 'Last 30 Days', shortLabel: '30d' },
            { label: 'Last 3 Months', value: 'Last 3 Months', shortLabel: '3mo' },
            { label: 'Last 12 Months', value: 'Last 12 Months', shortLabel: '12mo' },
            { label: 'All Time', value: 'All Time', shortLabel: 'All' },
        ];
        return options.map(opt => ({
            ...opt,
            pillClass: this.filterValues.LastUpdated === opt.value ? 'bci-time-pill active' : 'bci-time-pill'
        }));
    }

    get stateOptions() {
        return [
            { label: 'None', value: null },
            { label: 'New South Wales', value: 'NSW' },
            { label: 'Victoria', value: 'VIC' },
            { label: 'Tasmania', value: 'TAS' },
            { label: 'Western Australia', value: 'WA' },
            { label: 'Queensland', value: 'QLD' },
            { label: 'South Australia', value: 'SA' },
            { label: 'Northern Territory', value: 'NT' },
            { label: 'Australian Capital Territory', value: 'ACT' },
        ];
    }

    get groupOptions() {
        const options = [
            { label: 'All', value: 'All_Projects' },
            { label: 'Following', value: 'Following_Projects' },
            { label: 'My Accounts', value: 'Accounts_Matches' },
        ];
        return options.map(opt => ({
            ...opt,
            buttonClass: this.groupValue === opt.value ? 'bci-view-toggle-btn active' : 'bci-view-toggle-btn'
        }));
    }

    get visiblecategoryOptions() {
        return this.categoryOptions.slice(0, 3);
    }

    get visiblecouncilOptions() {
        return this.councilOptions.slice(0, 6);
    }

    // ============================================
    // Computed Properties - Filter Section Classes
    // ============================================

    get timeRangeSectionClass() {
        return this.expandedSections.timeRange ? 'bci-filter-section expanded' : 'bci-filter-section';
    }

    get locationSectionClass() {
        return this.expandedSections.location ? 'bci-filter-section expanded' : 'bci-filter-section';
    }

    get detailsSectionClass() {
        return this.expandedSections.details ? 'bci-filter-section expanded' : 'bci-filter-section';
    }

    get viewOptionsSectionClass() {
        return this.expandedSections.viewOptions ? 'bci-filter-section expanded' : 'bci-filter-section';
    }

    // ============================================
    // Computed Properties - Filter Counts
    // ============================================

    get locationFilterCount() {
        let count = 0;
        if (this.filterValues.State) count++;
        if (this.filterValues.Council && this.filterValues.Council.length > 0) count += this.filterValues.Council.length;
        const nonDefaultCountries = this.filterValues.Country.filter(c => c !== 'Australia');
        if (nonDefaultCountries.length > 0 || this.filterValues.Country.length !== 1) {
            count += this.filterValues.Country.length > 1 ? this.filterValues.Country.length - 1 : 0;
        }
        return count > 0 ? count : null;
    }

    get detailsFilterCount() {
        let count = 0;
        if (this.filterValues.Developer) count++;
        if (this.filterValues.Cat_1_Name && this.filterValues.Cat_1_Name.length > 0) count += this.filterValues.Cat_1_Name.length;
        if (this.filterValues.Project_Stage && this.filterValues.Project_Stage.length > 0) count += this.filterValues.Project_Stage.length;
        return count > 0 ? count : null;
    }

    get activeFilterCount() {
        let count = 0;
        if (this.filterValues.LastUpdated && this.filterValues.LastUpdated !== 'Last 3 Months') count++;
        if (this.filterValues.State) count++;
        if (this.filterValues.Developer) count++;
        if (this.filterValues.Cat_1_Name && this.filterValues.Cat_1_Name.length > 0) count += this.filterValues.Cat_1_Name.length;
        if (this.filterValues.Project_Stage && this.filterValues.Project_Stage.length > 0) count += this.filterValues.Project_Stage.length;
        if (this.filterValues.Council && this.filterValues.Council.length > 0) count += this.filterValues.Council.length;
        if (this.filterValues.HideViewedProjects) count++;
        return count > 0 ? count : null;
    }

    // ============================================
    // Computed Properties - Active Filter Pills
    // ============================================

    get hasActiveFilters() {
        return this.activeFilterCount && this.activeFilterCount > 0;
    }

    get activeFilterPills() {
        const pills = [];

        // Time range (only if not default)
        if (this.filterValues.LastUpdated && this.filterValues.LastUpdated !== 'Last 3 Months') {
            pills.push({
                key: 'lastUpdated',
                label: this.filterValues.LastUpdated,
                filterType: 'LastUpdated',
                value: this.filterValues.LastUpdated
            });
        }

        // State
        if (this.filterValues.State) {
            pills.push({
                key: 'state',
                label: `State: ${this.filterValues.State}`,
                filterType: 'State',
                value: this.filterValues.State
            });
        }

        // Developer
        if (this.filterValues.Developer) {
            pills.push({
                key: 'developer',
                label: `Developer: ${this.filterValues.Developer}`,
                filterType: 'Developer',
                value: this.filterValues.Developer
            });
        }

        // Categories
        if (this.filterValues.Cat_1_Name && this.filterValues.Cat_1_Name.length > 0) {
            this.filterValues.Cat_1_Name.forEach((cat, idx) => {
                pills.push({
                    key: `cat_${idx}`,
                    label: cat,
                    filterType: 'Cat_1_Name',
                    value: cat
                });
            });
        }

        // Project Stages
        if (this.filterValues.Project_Stage && this.filterValues.Project_Stage.length > 0) {
            this.filterValues.Project_Stage.forEach((stage, idx) => {
                pills.push({
                    key: `stage_${idx}`,
                    label: stage,
                    filterType: 'Project_Stage',
                    value: stage
                });
            });
        }

        // Councils
        if (this.filterValues.Council && this.filterValues.Council.length > 0) {
            this.filterValues.Council.forEach((council, idx) => {
                pills.push({
                    key: `council_${idx}`,
                    label: council,
                    filterType: 'Council',
                    value: council
                });
            });
        }

        // Hide Viewed
        if (this.filterValues.HideViewedProjects) {
            pills.push({
                key: 'hideViewed',
                label: 'Hiding Viewed',
                filterType: 'HideViewedProjects',
                value: true
            });
        }

        return pills;
    }

    get hasData() {
        return this.bciProjects && this.bciProjects.length > 0;
    }

    // ============================================
    // Event Handlers - Accordion
    // ============================================

    toggleFilterSection(event) {
        const section = event.currentTarget.dataset.section;
        this.expandedSections = {
            ...this.expandedSections,
            [section]: !this.expandedSections[section]
        };
    }

    // ============================================
    // Event Handlers - View Toggle
    // ============================================

    handleViewToggleClick(event) {
        const value = event.currentTarget.dataset.value;
        if (value && value !== this.groupValue) {
            this.groupValue = value;
            this.handleApplyFilter();
        }
    }

    handleGroupChange(event) {
        const value = event.target.value;
        if (value) {
            this.groupValue = value;
        }
        this.handleApplyFilter();
    }

    // ============================================
    // Event Handlers - Time Range
    // ============================================

    handleTimeRangeClick(event) {
        const value = event.currentTarget.dataset.value;
        if (value) {
            this.filterValues = {
                ...this.filterValues,
                LastUpdated: value
            };
            this.handleApplyFilter();
        }
    }

    // ============================================
    // Event Handlers - Filter Pills
    // ============================================

    handleRemoveFilterPill(event) {
        const filterType = event.currentTarget.dataset.filter;
        const value = event.currentTarget.dataset.value;

        if (filterType === 'LastUpdated') {
            this.filterValues = { ...this.filterValues, LastUpdated: 'Last 3 Months' };
        } else if (filterType === 'State') {
            this.filterValues = { ...this.filterValues, State: null };
        } else if (filterType === 'Developer') {
            this.filterValues = { ...this.filterValues, Developer: null };
        } else if (filterType === 'Cat_1_Name') {
            this.filterValues = {
                ...this.filterValues,
                Cat_1_Name: this.filterValues.Cat_1_Name.filter(v => v !== value)
            };
            this.categoryOptions = this.categoryOptions.map(opt => ({
                ...opt,
                isChecked: opt.value === value ? false : opt.isChecked
            }));
        } else if (filterType === 'Project_Stage') {
            this.filterValues = {
                ...this.filterValues,
                Project_Stage: this.filterValues.Project_Stage.filter(v => v !== value)
            };
            this.projectStageOptions = this.projectStageOptions.map(opt => ({
                ...opt,
                isChecked: opt.value === value ? false : opt.isChecked
            }));
        } else if (filterType === 'Council') {
            this.filterValues = {
                ...this.filterValues,
                Council: this.filterValues.Council.filter(v => v !== value)
            };
            this.councilOptions = this.councilOptions.map(opt => ({
                ...opt,
                isChecked: opt.value === value ? false : opt.isChecked
            }));
        } else if (filterType === 'HideViewedProjects') {
            this.filterValues = { ...this.filterValues, HideViewedProjects: false };
        }

        this.handleApplyFilter();
    }

    // ============================================
    // Event Handlers - Checkboxes
    // ============================================

    handleHideViewedCheckboxChange(event) {
        event.stopPropagation();
        this.filterValues = {
            ...this.filterValues,
            HideViewedProjects: event.target.checked
        };
        this.handleApplyFilter();
    }

    handleHideViewedToggle(event) {
        // Prevent double-triggering from checkbox
        if (event.target.tagName === 'INPUT') return;
        this.filterValues = {
            ...this.filterValues,
            HideViewedProjects: !this.filterValues.HideViewedProjects
        };
        this.handleApplyFilter();
    }

    handleCategoryCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;

        this.categoryOptions = this.categoryOptions.map(option => ({
            ...option,
            isChecked: option.value === value ? isChecked : option.isChecked
        }));

        if (isChecked) {
            this.filterValues.Cat_1_Name = [...this.filterValues.Cat_1_Name, value];
        } else {
            this.filterValues.Cat_1_Name = this.filterValues.Cat_1_Name.filter(item => item !== value);
        }
        this.handleApplyFilter();
    }

    handleProjectStageCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;

        this.projectStageOptions = this.projectStageOptions.map(option => ({
            ...option,
            isChecked: option.value === value ? isChecked : option.isChecked
        }));

        if (isChecked) {
            this.filterValues.Project_Stage = [...this.filterValues.Project_Stage, value];
        } else {
            this.filterValues.Project_Stage = this.filterValues.Project_Stage.filter(item => item !== value);
        }
        this.handleApplyFilter();
    }

    handleCouncilCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;

        this.councilOptions = this.councilOptions.map(option => ({
            ...option,
            isChecked: option.value === value ? isChecked : option.isChecked
        }));

        if (isChecked) {
            this.filterValues.Council = [...this.filterValues.Council, value];
        } else {
            this.filterValues.Council = this.filterValues.Council.filter(item => item !== value);
        }
        this.handleApplyFilter();
    }

    handleCountryCheckboxChange(event) {
        const value = event.target.value;
        const checked = event.target.checked;

        this.countryOptions = this.countryOptions.map(opt => ({
            ...opt,
            isChecked: opt.value === value ? checked : opt.isChecked
        }));

        if (checked) {
            if (!this.filterValues.Country.includes(value)) {
                this.filterValues.Country = [...this.filterValues.Country, value];
            }
        } else {
            this.filterValues.Country = this.filterValues.Country.filter(v => v !== value);
        }

        this.handleApplyFilter();
    }

    // ============================================
    // Event Handlers - Modals
    // ============================================

    toggleCategoryShowMoreModal() {
        this.showCategoryModal = !this.showCategoryModal;
    }

    toggleCouncilShowMoreModal() {
        this.showCouncilModal = !this.showCouncilModal;
    }

    navigateToBciMap = () => {
        this.isBciMapModalOpen = !this.isBciMapModalOpen;
    }

    // ============================================
    // Event Handlers - Filter Panel
    // ============================================

    handleFilter() {
        this.showFilterPanel = !this.showFilterPanel;
    }

    handleFilterChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        if (field === 'Council') {
            this.filterValues[field] = value.length === 0 ? [] : value;
            this.councilOptions = this.councilOptions.map(option => ({
                ...option,
                isChecked: value.includes(option.value)
            }));
        } else if (field === 'Cat_1_Name') {
            this.filterValues[field] = value.length === 0 ? [] : value;
            this.categoryOptions = this.categoryOptions.map(option => ({
                ...option,
                isChecked: value.includes(option.value)
            }));
        } else if (field === 'Start_Date' || field === 'End_Date') {
            this.filterValues[field] = value;
            if (field === 'Start_Date') {
                this.startDate = value;
            } else {
                this.endDate = value;
            }

            const endDateInput = this.template.querySelector('lightning-input[data-field="End_Date"]');
            if (endDateInput && this.startDate && this.endDate && new Date(this.endDate) < new Date(this.startDate)) {
                endDateInput.setCustomValidity('End Date must be greater than Start Date.');
                endDateInput.reportValidity();
            } else if (endDateInput) {
                endDateInput.setCustomValidity('');
                endDateInput.reportValidity();
            }
        } else if (value) {
            this.filterValues[field] = value;
        } else {
            this.filterValues[field] = null;
        }

        if (field === 'LastUpdated' || field === 'State') {
            this.handleApplyFilter();
        }
    }

    handleEnterKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleApplyFilter();
        }
    }

    // ============================================
    // Event Handlers - Actions
    // ============================================

    handleRefresh() {
        this.handleApplyFilter();
    }

    async handleApplyFilter() {
        this.isLoading = true;
        this.sortBy = null;
        this.sortDirection = null;
        this.offset = 0;
        this.limit = 150;
        this.bciProjects = [];
        this.totalValue = 0;
        this.total = await getProjectCount({ filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue });
        this.isLoading = false;
        await this.loadMoreData();
    }

    async handleCancelFilter() {
        this.filterValues = {
            Cat_1_Name: [],
            Project_Stage: [],
            Council: [],
            Start_Date: null,
            End_Date: null,
            Developer: null,
            State: null,
            LastUpdated: 'Last 3 Months',
            Country: ['Australia'],
            HideViewedProjects: false
        };

        const resetOptions = options => options.map(option => ({ ...option, isChecked: false }));
        this.projectStageOptions = resetOptions(this.projectStageOptions);
        this.councilOptions = resetOptions(this.councilOptions);
        this.categoryOptions = resetOptions(this.categoryOptions);
        this.countryOptions = this.countryOptions.map(opt => ({
            ...opt,
            isChecked: opt.value === 'Australia'
        }));

        await this.handleApplyFilter();
    }

    // ============================================
    // Event Handlers - Sorting
    // ============================================

    async doSorting(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.offset = 0;
        this.limit = 150;
        this.bciProjects = [];
        this.totalValue = 0;
        this.total = await getProjectCount({ filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue });
        await this.loadMoreData();
    }

    // ============================================
    // Data Loading
    // ============================================

    async initData() {
        this.total = await getProjectCount({ filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue });
        await this.loadMoreData();
    }

    async loadMoreData(event) {
        if (this.isLoading || this.bciProjects.length >= this.total) {
            this.loadMoreStatus = 'No more data to load';
            this.initialLoading = false;
            return;
        }

        this.isLoading = true;
        this.loadMoreStatus = 'Loading...';

        try {
            const result = await getBciProject({
                offsetSize: this.offset,
                limitSize: this.limit,
                sortBy: this.sortBy,
                sortDirection: this.sortDirection,
                filtersJson: JSON.stringify(this.filterValues),
                groupValue: this.groupValue
            });

            let batchValue = 0;
            let projects = result.map(project => {
                const numericValue = parseFloat(project.Value__c) || 0;
                batchValue += numericValue;
                return {
                    ...project,
                    Value__c: new Intl.NumberFormat('en-AU', {
                        style: 'currency',
                        currency: 'AUD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(numericValue),
                    recordLink: `/lightning/r/Organisation__c/${project.Id}/view`
                };
            });

            this.bciProjects = [...this.bciProjects, ...projects];
            this.totalValue += batchValue;
            this.offset += this.limit;
            this.loadMoreStatus = '';
        } catch (error) {
            console.error(error);
            this.loadMoreStatus = 'Error loading data';
        } finally {
            this.isLoading = false;
            this.initialLoading = false;
        }
    }
}
