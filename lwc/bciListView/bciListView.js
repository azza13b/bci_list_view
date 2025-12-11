import { LightningElement, api, track, wire } from 'lwc';
//import getAllFields from '@salesforce/apex/BciController.getAllFields';
import getBciProject from '@salesforce/apex/BciController.getBciProject';
import getProjectCount from '@salesforce/apex/BciController.getProjectCount';
//import MyCustomTypeDatatable from 'c/myCustomTypeDatatable';
import getCategoryPicklistValues from '@salesforce/apex/BciController.getCategoryPicklistValues';
import getProjectStagePicklistValues from '@salesforce/apex/BciController.getProjectStagePicklistValues';
import getCouncilPicklistValues from '@salesforce/apex/BciController.getCouncilPicklistValues';


const COLUMNS = [
    { label: 'Last Updated', fieldName: 'Time_Stamp__c', initialWidth: 120, type: 'date', sortable: true, hideDefaultActions: true },
    //{ label: 'Stage', fieldName: 'Project_Stage__c', type: 'text' , sortable: true, hideDefaultActions: true},
    { label: 'Overview', fieldName: 'recordLink', type: 'url', hideDefaultActions: true, typeAttributes: { label: { fieldName: 'BCI_Name__c' }, target: '_blank' } },
    { label: 'Location', fieldName: 'Location__c', type: 'text',  sortable: true, initialWidth: 270, hideDefaultActions: true },
    { label: 'Value', fieldName: 'Value__c', type: 'text', sortable: true, initialWidth: 120, hideDefaultActions: true },
    { label: 'Developer', fieldName: 'Developer__c', type: 'text',  hideDefaultActions: true },
    //{ label: 'Matched Status', fieldName: 'BCI_Matched__c', type: 'text' , hideDefaultActions: true},
    /*
    {
        label: "Match",
        type: "richTextColumn",
        fieldName: "BCI_Matched__c",
        initialWidth: 60,
        hideDefaultActions: true,
        typeAttributes: {
            richText: { fieldName: "BCI_Matched__c" },
            cssClass: 'center-align'
        }
    },
    */
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
    //@track columns = COLUMNS;
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

    @track offset = 0;
    @track limit = 150;
    @track total = 0;
    @track isLoading = false;
    @track initialLoading = true;
    @track loadMoreStatus = '';

    @track sortBy;
    @track sortDirection;

    @track showFilterPanel = true;

    @wire(getCategoryPicklistValues)
    wiredPicklistValues({ data, error }) {
        if (data) {
            this.categoryOptions = data.map(option => ({
                label: option.label,
                value: option.value,
                isChecked: false
            }));
            console.log('categoryOptions: ', JSON.stringify(this.categoryOptions));
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
            console.log('projectStageOptions: ', JSON.stringify(this.projectStageOptions));
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
            console.log('councilOptions: ', JSON.stringify(this.councilOptions));
        } else if (error) {
            console.error('Error fetching picklist values', error);
        }
    }

    async connectedCallback() {
        //this.getBciProjectFunc();
        this.initData();

    }

    handleMenuSelect(event) {
        if (event.detail.value === 'resetWidths') {
            this.columns = JSON.parse(JSON.stringify(COLUMNS)); // reset clean
        }
    }

    countryOptions = [
        { label: 'Australia', value: 'Australia', isChecked: true },
        { label: 'New Zealand', value: 'New Zealand', isChecked: false },
        { label: 'United Kingdom', value: 'United Kingdom', isChecked: false }
    ];


    get lastUpdatedOptions() {
        return [
            { label: 'Last 7 Days', value: 'Last 7 Days' },
            { label: 'Last 30 Days', value: 'Last 30 Days' },
            { label: 'Last 3 Months', value: 'Last 3 Months' },
            { label: 'Last 12 Months', value: 'Last 12 Months' },
            { label: 'All Time', value: 'All Time' },
        ];
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

    get visiblecategoryOptions() {
        return this.categoryOptions.slice(0, 3);
    }

    
    handleHideViewedCheckboxChange(event) {
        this.filterValues = {
            ...this.filterValues,
            HideViewedProjects: event.target.checked
        };
        console.log('handleHideViewedCheckboxChange: '+ this.filterValues.HideViewedProjects);
        this.handleApplyFilter();
    }


    handleCategoryCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;


        const option = this.categoryOptions.find(option => option.value === value);
        if (option) {
            option.isChecked = isChecked;
        }


        if (isChecked) {
            this.filterValues.Cat_1_Name.push(value);
        } else {
            this.filterValues.Cat_1_Name = this.filterValues.Cat_1_Name.filter(item => item !== value);
        }
        console.log('filterValues: ', JSON.stringify(this.filterValues));
    }

    toggleCategoryShowMoreModal() {
        this.showCategoryModal = !this.showCategoryModal;
        console.log('showCategoryModal: ', this.showCategoryModal);
    }

    get visiblecouncilOptions() {
        return this.councilOptions.slice(0, 3);
    }

    handleCouncilCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;


        const option = this.councilOptions.find(option => option.value === value);
        if (option) {
            option.isChecked = isChecked;
        }


        if (isChecked) {
            this.filterValues.Council.push(value);
        } else {
            this.filterValues.Council = this.filterValues.Council.filter(item => item !== value);
        }
        console.log('filterValues: ', JSON.stringify(this.filterValues));
    }

    toggleCouncilShowMoreModal() {
        this.showCouncilModal = !this.showCouncilModal;
        console.log('showCouncilModal: ', this.showCouncilModal);
    }

    handleProjectStageCheckboxChange(event) {
        const value = event.target.value;
        const isChecked = event.target.checked;


        const option = this.projectStageOptions.find(option => option.value === value);
        if (option) {
            option.isChecked = isChecked;
        }


        if (isChecked) {
            this.filterValues.Project_Stage.push(value);
        } else {
            this.filterValues.Project_Stage = this.filterValues.Project_Stage.filter(item => item !== value);
        }
        console.log('filterValues: ', JSON.stringify(this.filterValues));
    }


    handleFilter() {
        this.showFilterPanel = !this.showFilterPanel;
    }

    get groupOptions() {
        return [
            { label: 'All Projects', value: 'All_Projects' },
            { label: 'Following Projects', value: 'Following_Projects' },
            { label: 'My Accounts', value: 'Accounts_Matches' },
            //{ label: 'Viewed Projects', value: 'Viewed_Projects' },
        ];
    }

    async doSorting(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        console.log('sortBy: '+this.sortBy);
        console.log('sortDirection: '+this.sortDirection);
        this.offset = 0;
        this.limit = 150;
        this.bciProjects = [];
        this.total = await getProjectCount({filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue});
        console.log('this.total: '+ this.total);
        await this.loadMoreData();
    }

    handleRefresh(){
        this.handleApplyFilter();
    }

    async handleApplyFilter(){
        this.isLoading = true;
        this.sortBy = null;
        this.sortDirection = null;
        this.offset = 0;
        this.limit = 150;
        this.bciProjects = [];
        this.total = await getProjectCount({filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue});
        console.log('this.total: '+ this.total);
        this.isLoading = false;
        await this.loadMoreData();
    }

    async handleCancelFilter(){
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

        console.log('filterValues: ', JSON.stringify(this.filterValues));

    }

    async initData() {
        this.total = await getProjectCount({filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue});
        console.log('initData>this.total: '+ this.total);
        await this.loadMoreData();
    }


    async getBciProjectFunc(){
        this.isLoading = true ; 
        try {
            const result = await getBciProject({ })
            if(result){
                console.log('getBciProjectFunc: '+ JSON.stringify(result));
                this.bciProjects = result.map(project => ({
                    ...project ,
                    recordLink: `/lightning/r/Organisation__c/${project.Id}/view`
                }));
            } 
        } catch (error) {
            console.error('Error getBciProjectFunc', error);
        } finally {
            this.isLoading = false ; 
        }
    }

    async loadMoreData(event) {
        if (this.isLoading || this.bciProjects.length >= this.total) {
            //if (event) event.target.isLoading = false;
            this.loadMoreStatus = 'No more data to load';
            this.initialLoading = false;
            return;
        }

        this.isLoading = true;
        console.log('isLoading: '+ this.isLoading);
        this.loadMoreStatus = 'Loading...';
        //if (event) event.target.isLoading = true;

        try {
            const result = await getBciProject({ offsetSize: this.offset, limitSize: this.limit, sortBy: this.sortBy, sortDirection: this.sortDirection, filtersJson: JSON.stringify(this.filterValues), groupValue: this.groupValue});
            console.log('result: '+ JSON.stringify(result));
            let projects = result.map(project => ({
                ...project ,
                Value__c: new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(project.Value__c),
                recordLink: `/lightning/r/Organisation__c/${project.Id}/view`
            }));
            this.bciProjects = [...this.bciProjects, ...projects];
            this.offset += this.limit;
            this.loadMoreStatus = '';
        } catch (error) {
            console.error(error);
            this.loadMoreStatus = 'Error loading data';
        } finally {
            this.isLoading = false;
            this.initialLoading = false;
            console.log('isLoading: '+ this.isLoading);
            //if (event) event.target.isLoading = false;
        }
    }
/*
    get mainTableClass() {
        return this.showFilterPanel ? 'slds-size_10-of-12' : 'slds-size_1-of-1';
    }
*/
    handleEnterKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleApplyFilter();
        }
    }

    get data() {
        return this.projects;
    }

    get hasData() {
        return this.bciProjects && this.bciProjects.length > 0;
    }
    /*
    navigateToBciMap() {
        window.open('https://map.stamfordcapital.app/', '_blank');

    }
    */
    navigateToBciMap = () => {
        this.isBciMapModalOpen = !this.isBciMapModalOpen;
    }

    handleFilterChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        if (field === 'Council') {
            if(value.length === 0){
                this.filterValues[field] = [];
            } else {
                this.filterValues[field] = value;

            }
            const selectedOptions = event.target.value;
                this.councilOptions.forEach(option => {
                    option.isChecked = selectedOptions.includes(option.value);
                });
        } else if (field === 'Cat_1_Name') {
            if(value.length === 0){
                this.filterValues[field] = [];
            } else {
                this.filterValues[field] = value;

            }
            const selectedOptions = event.target.value;
                this.categoryOptions.forEach(option => {
                    option.isChecked = selectedOptions.includes(option.value);
                });
        }  else if (field == 'Start_Date' || field == 'End_Date') {
        // Update filter values for start and end dates
            if (field === 'Start_Date') {
                this.filterValues[field] = value;
                this.startDate = value; // Store the start date
            } else if (field === 'End_Date') {
                this.filterValues[field] = value;
                this.endDate = value; // Store the end date
            }

            const endDateInput = this.template.querySelector('lightning-input[data-field="End_Date"]');

            if (this.startDate && this.endDate && new Date(this.endDate) < new Date(this.startDate)) {
                // Set the error message for End Date if the condition fails
                endDateInput.setCustomValidity('End Date must be greater than Start Date.');
                endDateInput.reportValidity(); // Trigger the validity check and show the error message
            } else {
                // Clear the error message if the condition is satisfied
                endDateInput.setCustomValidity('');
                endDateInput.reportValidity(); // Trigger validity check to clear the error message
            }
            console.log('endDateError: ', this.endDateError);
        } else if (value) {
            this.filterValues[field] = value;
        } else {
            this.filterValues[field] = null;
        }
        console.log('filterValues: ', JSON.stringify(this.filterValues));

        if(field == 'LastUpdated' || field == 'State' ){
            this.handleApplyFilter();
        }
    }

    handleGroupChange(event) {

        const value = event.target.value;

        if (value) {
            this.groupValue = value;
        }
        console.log('groupValue: ', this.groupValue);
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
                this.filterValues.Country.push(value);
            }
        } else {
            this.filterValues.Country = this.filterValues.Country.filter(v => v !== value);
        }

        console.log('filterValues: ', JSON.stringify(this.filterValues));

        this.handleApplyFilter();
    }


/*
    createColumns(data) {
        const firstRecord = data[0]; // Assuming all records have the same fields
        if (!firstRecord) return [];

        // Dynamically create columns based on the keys in the first record
        const columnDefs = Object.keys(firstRecord).map(fieldName => {
            return {
                label: this.capitalizeFirstLetter(fieldName),
                fieldName: fieldName,
                type: 'text'
            };
        });
        return columnDefs;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
*/
}