$(async () => {
    const rute = await useFetch({ url: "/coffee/access/ctrl/ctrl-access.php", data: { opc: "logout" } });
    window.location.href = rute;
});
