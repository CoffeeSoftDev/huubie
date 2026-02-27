function tabLayout(options) {
    const defaults = {
        parent: "root",
        id: "tabLayout",
        theme: "light",
        type: "button",
        renderContainer: true,
        json: []
    };

    const opts = Object.assign({}, defaults, options);

    const isDark = opts.theme === "dark";
    const bgTab = isDark ? "bg-[#1F2A37]" : "bg-white";
    const bgActive = isDark ? "bg-[#374151]" : "bg-blue-600";
    const textActive = "text-white";
    const textInactive = isDark ? "text-gray-400" : "text-gray-600";
    const borderColor = isDark ? "border-gray-700" : "border-gray-300";

    const container = $("<div>", {
        id: opts.id,
        class: `w-full ${bgTab}`
    });

    const tabsContainer = $("<div>", {
        class: `flex gap-2 border-b ${borderColor} px-4 pt-4`
    });

    opts.json.forEach((tab, index) => {
        const isActive = tab.active || index === 0;
        
        const button = $("<button>", {
            type: "button",
            class: `flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${tab.class || ""} ${
                isActive 
                    ? `${bgActive} ${textActive} font-semibold` 
                    : `${textInactive} hover:bg-gray-100 hover:text-gray-800`
            }`,
            "data-tab": tab.id,
            click: function() {
                tabsContainer.find("button").removeClass(`${bgActive} ${textActive} font-semibold`)
                    .addClass(textInactive);
                
                $(this).removeClass(textInactive)
                    .addClass(`${bgActive} ${textActive} font-semibold`);

                if (opts.renderContainer) {
                    $(`#content-${opts.id} > div`).hide();
                    $(`#container-${tab.id}`).show();
                }

                if (tab.onClick) {
                    tab.onClick();
                }
            }
        });

        if (tab.icon) {
            button.append(`<i data-lucide="${tab.icon}" class="w-4 h-4"></i>`);
        }

        button.append(`<span>${tab.tab}</span>`);
        
        tabsContainer.append(button);
    });

    container.append(tabsContainer);

    if (opts.renderContainer) {
        const contentContainer = $("<div>", {
            id: `content-${opts.id}`,
            class: "p-4"
        });

        opts.json.forEach((tab, index) => {
            const tabContent = $("<div>", {
                id: `container-${tab.id}`,
                class: "w-full",
                style: (tab.active || index === 0) ? "" : "display: none;"
            });
            contentContainer.append(tabContent);
        });

        container.append(contentContainer);
    }

    $(`#${opts.parent}`).html(container);

    if (typeof lucide !== 'undefined') {
        setTimeout(() => {
            lucide.createIcons();
        }, 50);
    }
}
