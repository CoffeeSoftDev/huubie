$(async () => {
    const rute = await useFetch({ url: "/alpha/access/ctrl/ctrl-access.php", data: { opc: "logout" } });
    window.location.href = rute;
});
