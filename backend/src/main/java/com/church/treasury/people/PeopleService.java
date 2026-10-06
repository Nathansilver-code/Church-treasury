package com.church.treasury.people;

import com.church.treasury.repository.PersonRepository;
import com.church.treasury.repository.SqlText;
import java.util.List;
import org.springframework.stereotype.Service;

/** Name suggestions while the treasurer types. */
@Service
public class PeopleService {

    private final PersonRepository people;

    public PeopleService(PersonRepository people) {
        this.people = people;
    }

    public List<String> suggest(String typed) {
        String text = typed == null ? "" : typed.trim();
        if (text.isEmpty()) {
            return List.of();
        }
        String escaped = SqlText.escapeLike(text);
        return people.search("%" + escaped + "%", escaped + "%");
    }
}
