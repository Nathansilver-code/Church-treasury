package com.church.treasury.api;

import com.church.treasury.people.PeopleService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/people")
public class PeopleController {

    private final PeopleService service;

    public PeopleController(PeopleService service) {
        this.service = service;
    }

    @GetMapping
    public List<String> search(@RequestParam(defaultValue = "") String q) {
        return service.suggest(q);
    }
}
